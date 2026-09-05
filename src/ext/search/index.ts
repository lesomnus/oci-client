import type { SearchDialect } from '../../registry'
import type { SearchExtension } from './t'
import { V1 } from './v1'
import { Zot } from './zot'

export * from './t'
export * from './v1'
export * from './zot'

/**
 * Picks the extension that speaks the given dialect, or `undefined` if it is
 * not one that is implemented here.
 *
 * It is what {@link ClientV2.detect} reports as `features.search`, so the two
 * together compose a client for whichever registry is on the other end.
 *
 * @example
 * ```ts
 * const { features } = await client.detect().unwrap()
 * const Search = ext.search.of(features.search)
 * if (Search !== undefined) {
 *   const searchable = new (ClientV2.with(Search))(domain)
 *   await searchable.search('nginx').unwrap()
 * }
 * ```
 */
export function of(dialect: undefined | SearchDialect): undefined | SearchExtension {
	switch (dialect) {
		case 'zot':
			return Zot
		case 'v1':
			return V1

		default:
			return undefined
	}
}
