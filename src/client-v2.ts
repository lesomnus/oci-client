import { RepoV2 } from './api'
import { TransportAuthorizer } from './auth'
import { ClientBase, type ClientExtension, type ClientInit } from './client'
import { ResError } from './error'
import { Ref } from './ref'
import Patterns from './regexp'
import { result } from './result'
import { FetchTransport, type Transport, TransportChain } from './transport'

function clientV2<T extends ClientExtension>(Base: T) {
	return class ClientV2 extends Base {
		/**
		 * Tests if the registry supports OCI Distribution APIs and this client is authenticated.
		 * It throws {@link ResError} if the response status is NOT `200 OK`.
		 *
		 * @see Spec {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#determining-support | Determining Support} `end-1`.
		 */
		ping() {
			const u = `https://${this.domain}/v2/`
			const res = this.transport.fetch(u).then(res => {
				let msg = 'unknown server response'
				switch (res.status) {
					case 200:
						return res

					case 401:
						msg = 'unauthorized'
						break

					case 404:
						msg = 'v2 API not supported'
						break
				}

				throw new ResError(res, msg)
			})
			return result(res, () => Promise.resolve({}))
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
}

function evaluate(domain: string, init?: ClientInit): [string, Transport] {
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

	return [domain, transport]
}

export class ClientV2 extends clientV2(ClientBase) {
	// TODO: I want something like:
	// ClientV2.with(Catalog, ExtA, ExtB, ...)
	static with<T extends ClientExtension>(extension: T) {
		const C = clientV2(extension)
		return class V2 extends C {
			constructor(domain: string, init?: ClientInit) {
				const [d, t] = evaluate(domain, init)
				super(d, t)
			}
		}
	}

	constructor(domain: string, init?: ClientInit) {
		const [d, t] = evaluate(domain, init)
		super(d, t)
	}
}
