import type { ClientExtension } from '../../client'
import { ResError } from '../../error'
import { type Req, wrap } from '../../result'
import type { Transport } from '../../transport'
import type { Opts, Res, Searchable } from './t'

// Only the fields that `Res` is made of are requested; use `graphql` to ask
// for what zot holds beyond it.
const Document = `query Search($query: String!, $page: PageInput) {
	GlobalSearch(query: $query, requestedPage: $page) {
		Page { TotalCount }
		Repos {
			Name
			LastUpdated
			DownloadCount
			StarCount
		}
	}
}`

type GlobalSearch = {
	GlobalSearch?: {
		Page?: { TotalCount?: number }
		Repos?: {
			Name: string
			LastUpdated?: null | string
			DownloadCount?: null | number
			StarCount?: null | number
		}[]
	}
}

function post(transport: Transport, domain: string, document: string, variables?: Record<string, unknown>): Promise<Response> {
	return transport.fetch(`https://${domain}/v2/_zot/ext/search`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query: document, variables }),
	})
}

/**
 * Reads the data of a GraphQL response.
 *
 * An error of the query is not an error response of the registry: it is
 * reported in the body, with `200 OK` if the query ran and `422` if it did not
 * even parse. It is raised here so the reason is not lost, which means it is
 * not reported through `unwrapOr` like an error of the distribution API is.
 */
async function dataOf<T>(res: Response): Promise<T> {
	const payload = await res.json()
	const [error] = payload.errors ?? []
	if (error !== undefined) {
		throw new Error(`query failed: ${error.message}`)
	}
	if (res.status >= 400) {
		throw new ResError(res, `unexpected status code: ${res.status}`)
	}

	return payload.data as T
}

/**
 * Searches the repositories of *zot*, which serves a GraphQL API.
 *
 * Note that the search extension has to be enabled on the registry; it answers
 * `404 Not Found` otherwise, which `/v2/_oci/ext/discover` tells in advance.
 *
 * @see {@link https://zotregistry.dev/v2.1.0/user-guides/user-guide-cli/ | zot}
 *
 * @example
 * ```ts
 * const client = ClientV2.with(ext.search.Zot).make('localhost:5000')
 * const v = await client.search('alpine', { n: 10 }).unwrap()
 * ```
 */
export function Zot(Base: ClientExtension) {
	return class Zot extends Base implements Searchable {
		/**
		 * Sends a GraphQL document to the search extension, which is how the
		 * queries that {@link search} does not cover are reached.
		 */
		graphql<T extends {}>(document: string, variables?: Record<string, unknown>): Req<T> {
			const req = post(this.transport, this.domain, document, variables)
			return wrap(req, res => dataOf<T>(res))
		}

		search(query: string, opts?: Opts): Req<Res> {
			const { n, page = 1 } = opts ?? {}
			if (page < 1) {
				throw new Error('"page" starts from 1')
			}

			// zot takes an offset where the others take a page.
			const variables = n === undefined ? { query } : { query, page: { limit: n, offset: (page - 1) * n } }
			const req = post(this.transport, this.domain, Document, variables)

			return wrap(req, async res => {
				const { GlobalSearch: v } = await dataOf<GlobalSearch>(res)
				return {
					total: v?.Page?.TotalCount,
					repositories: (v?.Repos ?? []).map(r => ({
						name: r.Name,
						stars: r.StarCount ?? undefined,
						downloads: r.DownloadCount ?? undefined,
						lastUpdated: r.LastUpdated ? new Date(r.LastUpdated) : undefined,
					})),
				}
			})
		}
	}
}
