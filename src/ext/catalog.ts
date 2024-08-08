import { ClientBase, type ClientExtension } from '../client'
import { type Req, wrap } from '../result'

export type CatalogRes = {
	repositories: string[]
}

export function Catalog<T extends ClientExtension>(
	// FIXME: default value does not need if ClientV2.with is implemented as intended
	//@ts-ignore
	Base: T = ClientBase,
) {
	return class Catalog extends Base {
		catalog(): Req<CatalogRes> {
			const u = `https://${this.domain}/v2/_catalog`
			const req = this.transport.fetch(u)
			return wrap(req, async raw => {
				return (await raw.json()) as CatalogRes
			})
		}
	}
}
