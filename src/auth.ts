import { ResError } from './error'
import { methodOf, type ReqInit, type Transport, type TransportMiddleware, urlOf, withHeaders } from './transport'

export type Credential = {
	username: string
	password: string
}

/**
 * Provides a credential for the given authentication realm.
 * It returns `undefined` if there is no credential for the realm,
 * in which case the authentication is attempted anonymously.
 */
export type CredentialProvider = (realm: string) => undefined | Credential | Promise<undefined | Credential>

export type TransportAuthorizerInit = {
	credential?: Credential | CredentialProvider
}

export type Challenge = {
	/** Authentication scheme in lowercase, e.g. "bearer" or "basic". */
	scheme: string
	realm: string
	service?: string
	scope?: string
}

// It does not implements RFC 7235 challenge parsing
// but only parses challenge given by CNCF distribution.
export function parseChallenge(text: string): Challenge {
	// Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull"
	const i = text.indexOf(' ')
	const scheme = (i < 0 ? text : text.slice(0, i)).toLowerCase()

	const kv = /(\w+)=["]([^"]*)["]/g
	const o: Record<string, string> = {}
	while (true) {
		const match = kv.exec(text)
		if (match === null) {
			break
		}

		o[match[1]] = match[2]
	}

	if (o.realm === undefined) {
		throw new SyntaxError('challenge does not have a realm')
	}

	return { ...o, scheme } as Challenge
}

function encodeBasic({ username, password }: Credential): string {
	// `btoa` accepts Latin-1 only so the credential is encoded into UTF-8 first.
	const bytes = new TextEncoder().encode(`${username}:${password}`)
	let s = ''
	for (const b of bytes) {
		s += String.fromCharCode(b)
	}

	return `Basic ${btoa(s)}`
}

function challengeKeyOf(c: Challenge): string {
	return [c.scheme, c.realm, c.service ?? '', c.scope ?? ''].join('\n')
}

// Key of the requests that are expected to be answered with the same challenge.
function requestKeyOf(resource: RequestInfo | URL, init: ReqInit | undefined): undefined | string {
	const name = init?.endpoint?.name
	if (name === undefined) {
		// The request is not for a repository so there is nothing to guess the
		// scope of the challenge with.
		return undefined
	}

	return [urlOf(resource).host, name, methodOf(resource, init)].join('\n')
}

/**
 * Handles the token authentication of CNCF distribution.
 *
 * The authorization is negotiated lazily: a request is sent as-is and, if it is
 * answered with `401 Unauthorized`, it is retried with what the challenge asks
 * for. The result is remembered so the following requests to the same
 * repository carry it from the first attempt.
 *
 * Note that a request of which body is a `ReadableStream` cannot be retried
 * since the stream is already consumed by the first attempt.
 *
 * @example
 * ```ts
 * const client = new ClientV2('index.docker.io', {
 *   credential: { username: 'j.doe', password: '...' },
 * })
 * ```
 */
export class TransportAuthorizer implements TransportMiddleware {
	#credential?: Credential | CredentialProvider

	// Challenge key to the value of the "Authorization" header for it.
	#authorizations = new Map<string, string>()
	// Request key to the key of the challenge it was answered with.
	#challenges = new Map<string, string>()

	constructor(init: TransportAuthorizerInit = {}) {
		this.#credential = init.credential
	}

	#known(resource: RequestInfo | URL, init: ReqInit | undefined): undefined | string {
		const k = requestKeyOf(resource, init)
		if (k === undefined) {
			return undefined
		}

		const challenge = this.#challenges.get(k)
		return challenge === undefined ? undefined : this.#authorizations.get(challenge)
	}

	async fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response> {
		const known = this.#known(resource, init)
		const res = await (known === undefined //
			? next.fetch(resource, init)
			: next.fetch(...withHeaders(resource, init, { Authorization: known })))
		if (res.status !== 401) {
			return res
		}

		const text = res.headers.get('www-authenticate')
		if (text === null) {
			throw new ResError(res, 'unauthorized but challenge is not given')
		}

		const challenge = parseChallenge(text)
		const authorization = await this.#authorize(challenge, next)
		if (authorization === undefined || authorization === known) {
			// There is nothing to answer the challenge with, or it is the very
			// authorization that was just rejected, so the response stands.
			return res
		}

		this.#authorizations.set(challengeKeyOf(challenge), authorization)
		const k = requestKeyOf(resource, init)
		if (k !== undefined) {
			this.#challenges.set(k, challengeKeyOf(challenge))
		}

		return next.fetch(...withHeaders(resource, init, { Authorization: authorization }))
	}

	async #credentialFor(realm: string): Promise<undefined | Credential> {
		return typeof this.#credential === 'function' ? this.#credential(realm) : this.#credential
	}

	/**
	 * Answers the challenge, or `undefined` if it cannot be answered, which is
	 * not an error on its own: there may be no credential for the realm, and a
	 * registry may refuse to issue a token for the scope it asked for itself.
	 * `ghcr.io` challenges `/v2/` with a placeholder scope and denies a token
	 * for it, for instance. The response that carried the challenge is the
	 * answer in that case, which says it is unauthorized.
	 */
	async #authorize(challenge: Challenge, next: Transport): Promise<undefined | string> {
		const credential = await this.#credentialFor(challenge.realm)
		if (challenge.scheme === 'basic') {
			return credential === undefined ? undefined : encodeBasic(credential)
		}
		if (challenge.scheme !== 'bearer') {
			throw new Error(`unsupported authentication scheme: ${challenge.scheme}`)
		}

		const u = new URL(challenge.realm)
		if (challenge.service !== undefined) {
			u.searchParams.set('service', challenge.service)
		}
		if (challenge.scope !== undefined) {
			u.searchParams.set('scope', challenge.scope)
		}

		// The token endpoint authenticates with the credential itself, if any.
		const res = await next.fetch(u, credential === undefined ? undefined : { headers: { Authorization: encodeBasic(credential) } })
		if (res.status >= 400) {
			return undefined
		}

		// "access_token" is the OAuth2 form that some registries answer with.
		const payload = await res.json()
		const token = payload.token ?? payload.access_token
		return typeof token === 'string' ? `Bearer ${token}` : undefined
	}
}
