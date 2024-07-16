export interface Transport {
	fetch(resource: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export class FetchTransport implements Transport {
	fetch(resource: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		return window.fetch(resource, init)
	}
}

export interface TransportMiddleware {
	fetch(resource: RequestInfo | URL, init: undefined | RequestInit, next: Transport): Promise<Response>
}

export class TransportChain implements Transport, TransportMiddleware {
	constructor(private middlewares: [TransportMiddleware, ...TransportMiddleware[], Transport]) {}

	fetch(resource: RequestInfo | URL, init?: RequestInit): Promise<Response>
	fetch(resource: RequestInfo | URL, init?: RequestInit, next?: Transport): Promise<Response> {
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
