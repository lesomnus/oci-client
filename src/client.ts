import type { Transport, TransportMiddleware } from './transport'

export type ClientInit = {
	transport?: Transport | [TransportMiddleware, ...TransportMiddleware[], Transport]
}

export interface Client {
	readonly domain: string
	readonly transport: Transport
}

export class ClientBase {
	constructor(
		readonly domain: string,
		readonly transport: Transport,
	) {}
}

// biome-ignore lint/suspicious/noExplicitAny: TS requires it
export type ClientExtension = new (...args: any[]) => ClientBase
