import type { Endpoint } from './endpoint'
import type { MediaType } from './media-type'

// Extra field for transport internal use.
export type ReqInit = RequestInit & {
	endpoint?: Endpoint
}

export interface Transport {
	fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response>
}

export class FetchTransport implements Transport {
	fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response> {
		return window.fetch(resource, init)
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

function normalizeReq(resource: RequestInfo | URL, init: ReqInit | undefined): [URL, ReqInit | undefined] {
	// TODO: make init.method === 'GET' if it is undefined?
	if (resource instanceof URL) {
		return [resource, init]
	}

	let u: URL
	if (typeof resource === 'string') {
		u = new URL(resource)
	} else {
		u = new URL(resource.url)
		init = new Request(resource, init)
	}

	return [u, init] as const
}

/**
 * Change the protocol part of the URL from "https" to "http".
 * Note that no changes are made if the protocol is not "https".
 */
export class Unsecure implements TransportMiddleware {
	fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response> {
		;[resource, init] = normalizeReq(resource, init)

		if (resource.protocol !== 'https') {
			resource.protocol = 'http'
		}
		return next.fetch(resource, init)
	}
}

export class PathRewrite implements TransportMiddleware {
	constructor(readonly rewrite: (path: string) => string) {}

	fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response> {
		;[resource, init] = normalizeReq(resource, init)

		resource.pathname = this.rewrite(resource.pathname)
		return next.fetch(resource, init)
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
		this.#manifests = manifests?.map(v => `${v}`).join(', ') ?? ''
	}

	fetch(resource: RequestInfo | URL, init: ReqInit | undefined, next: Transport): Promise<Response> {
		;[resource, init] = normalizeReq(resource, init)
		if (!(init?.method === undefined || init.method === 'GET')) {
			return next.fetch(resource, init)
		}

		let v = ''
		switch (init?.endpoint?.resource) {
			case 'manifests':
				v = this.#manifests
		}
		if (v === '') {
			return next.fetch(resource, init)
		}

		const headers = new Headers(init?.headers)
		headers.set('Accept', v)
		return next.fetch(resource, { ...init, headers })
	}
}
