import type { ClientExtension } from '../client'
import { makeParams } from '../params'
import { type Req, result } from '../result'

export type CatalogOpts = {
	/** Maximum number of the repositories to be returned. */
	n?: number
	/** Name of the last repository of the previous response. */
	last?: string
}

export type CatalogRes = {
	repositories: string[]
}

/**
 * Lists the repositories in the registry.
 *
 * @see {@link https://zotregistry.dev/v2.1.0/developer-guide/api-reference/#get-v2_catalog | Zot}
 * @see {@link https://github.com/distribution/distribution/blob/main/docs/content/spec/api.md#listing-repositories | distribution}
 *
 * @example
 * ```ts
 * const Client = ClientV2.with(Catalog)
 * const client = new Client('localhost:5000')
 * const v = await client.catalog({ n: 10 }).unwrap()
 * ```
 */
export function Catalog(Base: ClientExtension) {
	return class Catalog extends Base {
		catalog(opts?: CatalogOpts): Req<CatalogRes> {
			if (opts?.n !== undefined && opts.n < 0) {
				throw new Error('"n" cannot be negative number')
			}

			const u = `https://${this.domain}/v2/_catalog${makeParams(opts)}`
			const req = this.transport.fetch(u)
			return result(req, res => res.json())
		}
	}
}
