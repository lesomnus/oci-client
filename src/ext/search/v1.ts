import type { ClientExtension } from '../../client'
import { makeParams } from '../../params'
import { type Req, result } from '../../result'
import type { Opts, Res, Searchable } from './t'

type SearchV1Res = {
	num_results?: number
	results?: {
		name: string
		description?: string
		star_count?: number
		pull_count?: number
		is_official?: boolean
	}[]
}

/**
 * Searches the repositories through `/v1/search`, which is what `docker search`
 * asks and *Docker Hub* answers. It is not a part of the distribution spec but
 * a leftover of the Docker Registry HTTP API V1.
 *
 * @see {@link https://docs.docker.com/reference/cli/docker/search/ | docker search}
 *
 * @example
 * ```ts
 * const Client = ClientV2.with(ext.search.V1)
 * const client = new Client('index.docker.io')
 * const v = await client.search('nginx', { n: 10 }).unwrap()
 * ```
 */
export function V1(Base: ClientExtension) {
	return class V1 extends Base implements Searchable {
		search(query: string, opts?: Opts): Req<Res> {
			const { n, page = 1 } = opts ?? {}
			if (page < 1) {
				throw new Error('"page" starts from 1')
			}

			const params = makeParams({ q: query, n, page: page === 1 ? undefined : page })
			const req = this.transport.fetch(`https://${this.domain}/v1/search${params}`)

			return result(req, async res => {
				const v: SearchV1Res = await res.json()
				return {
					total: v.num_results,
					repositories: (v.results ?? []).map(r => ({
						name: r.name,
						// An empty description is not a description.
						description: r.description === '' ? undefined : r.description,
						stars: r.star_count,
						downloads: r.pull_count,
						official: r.is_official,
					})),
				}
			})
		}
	}
}
