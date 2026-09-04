import { type Credential, parseChallenge, TransportAuthorizer } from './auth'
import type { Endpoint } from './endpoint'
import { ResError } from './error'
import { type ReqInit, type Transport, TransportChain } from './transport'

const Realm = 'https://auth.x.com/token'

function challenge(scheme: string, params: Record<string, string> = { realm: Realm }) {
	const v = Object.entries(params)
		.map(([k, v]) => `${k}="${v}"`)
		.join(',')
	return `${scheme} ${v}`
}

type Call = {
	url: URL
	method: string
	authorization: null | string
}

// Answers `401 Unauthorized` unless the request carries `accepts` and serves a
// token at the realm.
class Registry implements Transport {
	calls: Call[] = []

	constructor(
		private accepts: string,
		private init: { scheme?: string; token?: string } = {},
	) {}

	get authorizations() {
		return this.calls.map(c => c.authorization)
	}

	// Requests that are not for the token endpoint.
	get apiCalls() {
		return this.calls.filter(c => c.url.origin !== new URL(Realm).origin)
	}

	fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response> {
		const req = new Request(resource instanceof URL ? resource.toString() : resource, init)
		const url = new URL(req.url)
		this.calls.push({ url, method: req.method, authorization: req.headers.get('Authorization') })

		if (url.origin === new URL(Realm).origin) {
			return Promise.resolve(Response.json({ token: this.init.token ?? 'T' }))
		}
		if (req.headers.get('Authorization') === this.accepts) {
			return Promise.resolve(new Response('OK', { status: 200 }))
		}

		return Promise.resolve(
			new Response(null, {
				status: 401,
				headers: {
					'WWW-Authenticate': challenge(this.init.scheme ?? 'Bearer', {
						realm: Realm,
						service: 'x.com',
						scope: 'repository:foo:pull',
					}),
				},
			}),
		)
	}
}

const endpoint = (name: string): Endpoint => ({ method: 'GET', name, resource: 'tags', action: 'list' })

describe('parseChallenge', () => {
	it('parses the scheme and the parameters', () => {
		const v = parseChallenge(
			'Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull"',
		)
		expect(v.scheme).to.eq('bearer')
		expect(v.realm).to.eq('https://auth.docker.io/token')
		expect(v.service).to.eq('registry.docker.io')
		expect(v.scope).to.eq('repository:library/node:pull')
	})
	it('parses a challenge without a parameter other than the realm', () => {
		const v = parseChallenge('Basic realm="x"')
		expect(v.scheme).to.eq('basic')
		expect(v.realm).to.eq('x')
		expect(v.service).to.be.undefined
	})
	it('fails if the realm is not given', () => {
		expect(() => parseChallenge('Bearer service="x"')).to.throw(SyntaxError)
	})
})

describe('TransportAuthorizer', () => {
	it('obtains a token anonymously and retries the request', async () => {
		const registry = new Registry('Bearer T')
		const transport = new TransportChain([new TransportAuthorizer(), registry])

		const res = await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })
		expect(res.status).to.eq(200)
		expect(registry.authorizations).to.eql([null, null, 'Bearer T'])
	})
	it('sends the credential to the token endpoint', async () => {
		const credential: Credential = { username: 'j.doe', password: 'pw' }
		const registry = new Registry('Bearer T')
		const transport = new TransportChain([new TransportAuthorizer({ credential }), registry])

		await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })
		expect(registry.calls[1].authorization).to.eq(`Basic ${btoa('j.doe:pw')}`)
	})
	it('resolves the credential by the realm', async () => {
		const realms: string[] = []
		const registry = new Registry('Bearer T')
		const transport = new TransportChain([
			new TransportAuthorizer({
				credential: realm => {
					realms.push(realm)
					return { username: 'a', password: 'b' }
				},
			}),
			registry,
		])

		await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })
		expect(realms).to.eql([Realm])
	})
	it('encodes a non Latin-1 credential', async () => {
		const registry = new Registry('Bearer T')
		const transport = new TransportChain([new TransportAuthorizer({ credential: { username: '한', password: '글' } }), registry])

		await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })
		const v = registry.calls[1].authorization ?? ''
		expect(v.startsWith('Basic ')).to.be.true
		expect(new TextDecoder().decode(Uint8Array.from(atob(v.slice('Basic '.length)), c => c.charCodeAt(0)))).to.eq('한:글')
	})
	it('reuses the authorization for the following requests', async () => {
		const registry = new Registry('Bearer T')
		const transport = new TransportChain([new TransportAuthorizer(), registry])

		await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })
		await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })

		// Only the first request is challenged; the second one is authorized at once.
		expect(registry.authorizations).to.eql([null, null, 'Bearer T', 'Bearer T'])
		expect(registry.apiCalls).to.have.lengthOf(3)
	})
	it('does not reuse the authorization for another repository', async () => {
		const registry = new Registry('Bearer T')
		const transport = new TransportChain([new TransportAuthorizer(), registry])

		await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })
		await transport.fetch('https://x.com/v2/bar/tags/list', { endpoint: endpoint('bar') })
		expect(registry.authorizations).to.eql([null, null, 'Bearer T', null, null, 'Bearer T'])
	})
	it('authorizes with the credential if the scheme is "Basic"', async () => {
		const credential: Credential = { username: 'j.doe', password: 'pw' }
		const registry = new Registry(`Basic ${btoa('j.doe:pw')}`, { scheme: 'Basic' })
		const transport = new TransportChain([new TransportAuthorizer({ credential }), registry])

		const res = await transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })
		expect(res.status).to.eq(200)
	})
	it('fails if the scheme is "Basic" but there is no credential', async () => {
		const registry = new Registry('never', { scheme: 'Basic' })
		const transport = new TransportChain([new TransportAuthorizer(), registry])

		await expect(transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })).rejects.toThrowError(/no credential/)
	})
	it('fails if the scheme is not supported', async () => {
		const registry = new Registry('never', { scheme: 'Digest' })
		const transport = new TransportChain([new TransportAuthorizer(), registry])

		await expect(transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })).rejects.toThrowError(/unsupported/)
	})
	it('fails if the challenge is not given', async () => {
		const transport = new TransportChain([
			new TransportAuthorizer(),
			{ fetch: () => Promise.resolve(new Response(null, { status: 401 })) },
		])

		await expect(transport.fetch('https://x.com/v2/foo/tags/list', { endpoint: endpoint('foo') })).rejects.toThrowError(ResError)
	})
	it('keeps the headers and the body of the retried request', async () => {
		let seen: Request | undefined
		const registry: Transport = {
			fetch(resource, init) {
				const req = new Request(resource instanceof URL ? resource.toString() : resource, init)
				if (new URL(req.url).origin === new URL(Realm).origin) {
					return Promise.resolve(Response.json({ token: 'T' }))
				}
				if (req.headers.get('Authorization') === null) {
					return Promise.resolve(new Response(null, { status: 401, headers: { 'WWW-Authenticate': challenge('Bearer') } }))
				}

				seen = req
				return Promise.resolve(new Response(null, { status: 200 }))
			},
		}
		const transport = new TransportChain([new TransportAuthorizer(), registry])

		await transport.fetch('https://x.com/v2/foo/blobs/uploads/', {
			method: 'POST',
			headers: { 'X-Kept': '42' },
			body: 'payload',
			endpoint: { method: 'POST', name: 'foo', resource: 'blobs', action: 'uploads' },
		})

		expect(seen?.method).to.eq('POST')
		expect(seen?.headers.get('X-Kept')).to.eq('42')
		await expect(seen?.text()).resolves.toBe('payload')
	})
})
