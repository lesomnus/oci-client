import { RepoV2 } from './api'
import { TransportAuthorizer } from './auth'
import { ResError } from './error'
import { Ref } from './ref'
import Patterns from './regexp'
import { type Result, result } from './result'
import { FetchTransport, type Transport, TransportChain, type TransportMiddleware } from './transport'

export type ClientInit = {
	transport?: Transport | [TransportMiddleware, ...TransportMiddleware[], Transport]
}

export class ClientV2 {
	readonly transport: Transport

	constructor(
		readonly domain: string,
		init?: ClientInit,
	) {
		if (!Patterns.Reference.Domain.test(domain)) {
			throw new Error('invalid domain')
		}

		if (init === undefined) {
			init = {}
		}

		let transport = init.transport
		if (transport === undefined) {
			transport = [
				new TransportAuthorizer(), //
				new FetchTransport(),
			]
		}
		if (Array.isArray(transport)) {
			transport = new TransportChain(transport)
		}
		this.transport = transport
	}

	/**
	 * Test if the server supports OCI v2 APIs and this client is authenticated.
	 * It throws `Response` if the status is not 200(OK).
	 *
	 * @see end-1
	 */
	async ping(): Promise<Result> {
		const u = `https://${this.domain}/v2/`

		const raw = await this.transport.fetch(u)
		if (raw.status !== 200) {
			let msg = 'unknown server response'
			switch (raw.status) {
				case 401:
					msg = 'unauthorized'
					break

				case 404:
					msg = 'v2 API not supported'
					break
			}

			throw new ResError(raw, msg)
		}

		return result(raw, () => Promise.resolve({}))
	}

	repo(ref: string | Ref): RepoV2 {
		if (typeof ref === 'string') {
			ref = Ref.parse(ref)
		}
		if (ref.domain === undefined) {
			ref = ref.withDomain(this.domain)
		}
		return new RepoV2(this.transport, ref)
	}
}
