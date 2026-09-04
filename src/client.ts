import type { Credential, CredentialProvider } from './auth'
import type { Transport, TransportMiddleware } from './transport'

export type ClientInit = {
	/**
	 * Credential to authenticate to the registry with.
	 * Note that it is ignored if `transport` is given since the authentication
	 * is performed by a middleware of the transport.
	 */
	credential?: Credential | CredentialProvider
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
