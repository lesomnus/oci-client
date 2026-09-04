import type { Req } from '../../result'

export type Opts = {
	/** Maximum number of the repositories to be returned. */
	n?: number
	/** Index of the page to be returned, which starts from 1. */
	page?: number
}

export type RepoSummary = {
	name: string
	/** Description of the repository, if the registry holds one. */
	description?: string
	/** Number of the stars given, if the registry counts them. */
	stars?: number
	/** Number of the pulls, if the registry counts them. */
	downloads?: number
	/** Whether the repository is curated by the registry. */
	official?: boolean
	/** When the repository was updated last, if the registry reports it. */
	lastUpdated?: Date
}

export type Res = {
	repositories: RepoSummary[]
	/** Number of the repositories that match, if the registry reports it. */
	total?: number
}

/**
 * Feature that a search extension adds to the client.
 *
 * Searching is not a part of the distribution spec so every registry does it
 * its own way; this is what they have in common. A field is `undefined` if the
 * registry does not report it, which differs by the implementation.
 *
 * @see {@link Zot} for zot, which serves a GraphQL API.
 * @see {@link V1} for the registries that serve `/v1/search`, e.g. Docker Hub.
 */
export interface Searchable {
	search(query: string, opts?: Opts): Req<Res>
}
