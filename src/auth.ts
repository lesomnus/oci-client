import { ResError } from './error'
import type { Transport, TransportMiddleware } from './transport'

// It does not implements RFC 7235 challenge parsing
// but only parses challenge given by CNCF distribution.
export function parseChallenge(text: string) {
	// Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/node:pull"
	const kv = /(\w+)=["]([^"]+)["]/g
	const o: Record<string, string> = {}
	while (true) {
		const match = kv.exec(text)
		if (match === null) {
			break
		}

		o[match[1]] = match[2]
	}

	return o as {
		realm: string
		service?: string
		scope?: string
	}
}

// Handles token authentication of CNCF distribution.
export class TransportAuthorizer implements TransportMiddleware {
	async fetch(resource: RequestInfo | URL, init: undefined | RequestInit, next: Transport): Promise<Response> {
		const res = await next.fetch(resource, init)
		if (res.status !== 401) {
			return res
		}

		const challenge = res.headers.get('www-authenticate')
		if (challenge === null) {
			throw new ResError(res, 'unauthorized but challenge is not given')
		}

		const c = parseChallenge(challenge)
		const params: string[] = []
		if (c.service !== undefined) {
			params.push(`service=${c.service}`)
		}
		if (c.scope !== undefined) {
			params.push(`scope=${c.scope}`)
		}

		let u = c.realm
		if (params.length > 0) {
			u += `?${params.join('&')}`
		}

		const token_res = await next.fetch(u)
		const token_payload = await token_res.json()
		const token = token_payload.token as string

		const headers = {
			...init?.headers,
			'Authorization': `Bearer ${token}`,
		}
		return await next.fetch(resource, {
			...init,
			headers,
		})
	}
}
