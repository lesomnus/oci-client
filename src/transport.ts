import type { Endpoint } from './endpoint'
import type { MediaType } from './media-types/t'

// Extra field for transport internal use.
export type ReqInit = RequestInit & {
	endpoint?: Endpoint
}

export interface Transport {
	fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response>
}

export class FetchTransport implements Transport {
	fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response> {
		return fetch(resource, init)
	}
}

export interface TransportMiddleware {
	fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response>
}

export class TransportChain implements Transport, TransportMiddleware {
	constructor(private middlewares: [TransportMiddleware, ...TransportMiddleware[], Transport]) {}

	fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response>
	fetch(resource: RequestInfo | URL, init?: ReqInit, next?: Transport): Promise<Response> {
		const middlewares = this.middlewares.slice()
		if (next !== undefined) {
			middlewares.push(next)
		}

		const makeNext: (i: number) => Transport = (i: number) => {
			const mw = middlewares[i]
			return {
				fetch: (resource, init) => {
					return mw.fetch(resource, init, makeNext(i + 1))
				},
			}
		}

		return makeNext(0).fetch(resource, init)
	}
}

/**
 * Returns a copy of the URL of the request.
 * The returned URL can be modified freely since it is never shared with `resource`.
 */
export function urlOf(resource: RequestInfo | URL): URL {
	if (resource instanceof Request) {
		return new URL(resource.url)
	}

	return new URL(resource)
}

/**
 * Returns the method of the request.
 * Note that `init` takes precedence over `resource` as `fetch` does.
 */
export function methodOf(resource: RequestInfo | URL, init?: ReqInit): string {
	if (init?.method !== undefined) {
		return init.method
	}

	return resource instanceof Request ? resource.method : 'GET'
}

/**
 * Returns a new request of which URL is rewritten by `rewrite`.
 * Neither `resource` nor the URL it holds is modified.
 */
export function withUrl(resource: RequestInfo | URL, rewrite: (url: URL) => void): RequestInfo | URL {
	const u = urlOf(resource)
	rewrite(u)

	// `Request` is immutable so it has to be recreated with the rewritten URL.
	return resource instanceof Request ? new Request(u, resource) : u
}

/**
 * Returns a new request with the given headers set on top of the existing ones.
 * Neither `resource` nor `init` is modified.
 */
export function withHeaders(
	resource: RequestInfo | URL,
	init: ReqInit | undefined,
	headers: Record<string, string>,
): [RequestInfo | URL, ReqInit | undefined] {
	if (resource instanceof Request) {
		// Properties of `Request` are defined on its prototype so they are lost
		// if it is spread into an object; it is recreated instead.
		const req = new Request(resource, init)
		for (const [k, v] of Object.entries(headers)) {
			req.headers.set(k, v)
		}

		// `endpoint` is not a part of `RequestInit` so it is not copied by `Request`.
		return [req, init?.endpoint === undefined ? undefined : { endpoint: init.endpoint }]
	}

	const h = new Headers(init?.headers)
	for (const [k, v] of Object.entries(headers)) {
		h.set(k, v)
	}

	return [resource, { ...init, headers: h }]
}

/**
 * Change the protocol part of the URL from "https" to "http".
 * Note that no changes are made if the protocol is not "https".
 */
export class Unsecure implements TransportMiddleware {
	fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response> {
		return next.fetch(
			withUrl(resource, u => {
				if (u.protocol === 'https:') {
					u.protocol = 'http:'
				}
			}),
			init,
		)
	}
}

export class PathRewrite implements TransportMiddleware {
	constructor(readonly rewrite: (path: string) => string) {}

	fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response> {
		return next.fetch(
			withUrl(resource, u => {
				u.pathname = this.rewrite(u.pathname)
			}),
			init,
		)
	}
}

/**
 * Add a prefix to the URL path.
 * If the URL already has the prefix, no changes are made.
 */
export class PathPrefix extends PathRewrite implements TransportMiddleware {
	constructor(prefix: string) {
		if (!prefix.startsWith('/')) {
			// normalize to absolute path.
			prefix = `/${prefix}`
		}

		super(p => (p.startsWith(prefix) ? p : `${prefix}${p}`))
	}
}

/**
 * Append HTTP "Accept" header on the request for the resource (tags, manifests, etc.).
 */
export class Accept implements TransportMiddleware {
	#manifests: string

	constructor({
		manifests,
	}: {
		manifests?: MediaType[]
	}) {
		this.#manifests = manifests?.join(', ') ?? ''
	}

	fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response> {
		// "HEAD" negotiates the content the same way "GET" does; a registry may
		// answer `404 Not Found` for a manifest it cannot represent as one of
		// the accepted media types.
		const method = methodOf(resource, init)
		if (method !== 'GET' && method !== 'HEAD') {
			return next.fetch(resource, init)
		}

		let v = ''
		switch (init?.endpoint?.resource) {
			case 'manifests':
				v = this.#manifests
				break
		}
		if (v === '') {
			return next.fetch(resource, init)
		}

		return next.fetch(...withHeaders(resource, init, { Accept: v }))
	}
}
