import type { MediaType } from './media-type'
import type { Reference } from './ref'

export type Endpoint = {
	name: string
} & (
	| { method: 'GET'; resource: 'blobs'; digest: string } // end-2
	| { method: 'HEAD'; resource: 'blobs'; digest: string } // end-2
	| { method: 'GET'; resource: 'manifests'; reference: Reference } // end-3
	| { method: 'HEAD'; resource: 'manifests'; reference: Reference } // end-3
	| { method: 'POST'; resource: 'blobs'; action: 'uploads'; digest?: string } // end-4
	| { method: 'PATCH'; resource: 'blobs'; action: 'uploads'; reference: Reference; digest?: string } // end-5
	| { method: 'PUT'; resource: 'blobs'; action: 'uploads'; reference: Reference; digest?: string } // end-6
	| { method: 'PUT'; resource: 'blobs'; action: 'manifests'; reference: Reference; digest?: string } // end-7
	| { method: 'GET'; resource: 'tags'; action: 'list'; n?: number; last?: string } // end-8
	| { method: 'DELETE'; resource: 'manifests'; reference: Reference } // end-9
	| { method: 'DELETE'; resource: 'blobs'; digest: string } // end-10
	| { method: 'POST'; resource: 'blobs'; action: 'uploads'; mount?: string; from?: string } // end-11
	| { method: 'GET'; resource: 'referrers'; artifactType?: string } // end-12
	| { method: 'GET'; resource: 'blobs'; action: 'uploads'; reference: Reference } // end-13
)

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
	fetch(resource: RequestInfo | URL, init: undefined | ReqInit, next: Transport): Promise<Response>
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

export class Unsecure implements TransportMiddleware {
	fetch(resource: RequestInfo | URL, init: undefined | ReqInit, next: Transport): Promise<Response> {
		let u = resource.toString()
		if (!u.startsWith('https://')) {
			return next.fetch(resource, init)
		}

		u = `http${u.slice('https'.length)}`
		let req: Request
		if (typeof resource === 'string' || resource instanceof URL) {
			req = new Request(u)
		} else {
			req = new Request(u, resource)
		}

		return next.fetch(req, init)
	}
}

export class Accept implements TransportMiddleware {
	#manifests: string

	constructor({
		manifests,
	}: {
		manifests?: MediaType[]
	}) {
		this.#manifests = manifests?.map(v => `${v}`).join(', ') ?? ''
	}

	fetch(resource: RequestInfo | URL, init: undefined | ReqInit, next: Transport): Promise<Response> {
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
