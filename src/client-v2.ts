import { RepoV2 } from './api'
import { TransportAuthorizer } from './auth'
import { ClientBase, type ClientExtension, type ClientInit, type ClientMixin } from './client'
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
			new TransportAuthorizer({ credential: init.credential }), //
			new FetchTransport(),
		]
	}
	if (Array.isArray(transport)) {
		transport = new TransportChain(transport)
	}

	return [domain, transport]
}

// biome-ignore lint/suspicious/noExplicitAny: it is required to distribute the union
type UnionToIntersection<U> = (U extends any ? (v: U) => void : never) extends (v: infer I) => void ? I : never

export class ClientV2 extends clientV2(ClientBase) {
	/**
	 * Creates a client class of which instances have the features added by the
	 * given extensions. The extensions are applied in the order they are given.
	 *
	 * @example
	 * ```ts
	 * const Client = ClientV2.with(Catalog)
	 * const client = new Client('index.docker.io')
	 * const v = await client.catalog().unwrap()
	 * ```
	 */
	static with<Ms extends ClientMixin[]>(...mixins: Ms) {
		let Base: ClientExtension = ClientBase
		for (const mixin of mixins) {
			Base = mixin(Base)
		}

		const C = clientV2(Base)
		return class V2 extends C {
			constructor(domain: string, init?: ClientInit) {
				const [d, t] = evaluate(domain, init)
				super(d, t)
			}
			// The mixins are composed at runtime so the type of the result has
			// to be described here.
		} as unknown as new (
			domain: string,
			init?: ClientInit,
		) => ClientV2 & UnionToIntersection<InstanceType<ReturnType<Ms[number]>>>
	}

	constructor(domain: string, init?: ClientInit) {
		const [d, t] = evaluate(domain, init)
		super(d, t)
	}
}
