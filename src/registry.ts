import type { Transport } from './transport'

/**
 * Extension the registry serves.
 *
 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/extensions/_oci.md | _oci Extension Endpoints}*.
 */
export type Extension = {
	/** Name of the extension as it appears in the URL path, e.g. `_zot`. */
	name: string
	/** URL of the document that defines the extension. */
	url: string
	description?: string
	/** Endpoints the extension serves, e.g. `/v2/_zot/ext/search`. */
	endpoints: string[]
}

export type ExtensionList = {
	extensions: Extension[]
}

/**
 * Implementation that serves the registry.
 * It is not a closed set; an unlisted implementation is still a valid value.
 */
export type Flavor = (string & {}) | 'zot' | 'distribution'

/**
 * Style of the search API a registry serves. It names the extension that
 * speaks it rather than the registry that happens to serve it, since a style
 * is not owned by one implementation.
 *
 * - `zot`: GraphQL on `/v2/_zot/ext/search`, which {@link ext.search.Zot} speaks.
 * - `v1`: `GET /v1/search`, which {@link ext.search.V1} speaks.
 */
export type SearchDialect = (string & {}) | 'zot' | 'v1'

/**
 * What a registry can actually be asked for, which is what decides whether an
 * extension is worth composing.
 *
 * It is not the same question as which implementation serves it: a *zot* built
 * without its extensions is still *zot* yet serves no search, and a registry
 * that puts its own API in front of another implementation serves what the one
 * in front offers, not what is behind.
 */
export type Features = {
	/**
	 * Style of the search API the registry serves,
	 * or `undefined` if it serves none.
	 */
	search?: SearchDialect
	/**
	 * Whether the catalog is served, or `undefined` if it could not be told,
	 * which is what a registry answers when it requires an authorization to
	 * list what it holds.
	 */
	catalog?: boolean
}

export type Implementation = {
	/**
	 * What the registry can be asked for. It is the answer to act on; see
	 * {@link Features} for why it is not the same as {@link flavor}.
	 */
	features: Features
	/**
	 * Implementation on the other end, or `undefined` if there is nothing to
	 * tell it apart. The spec does not require a registry to identify itself so
	 * this is read from what it advertises and, failing that, guessed from how
	 * it answers; only the former is a fact the registry states.
	 *
	 * It tells what the registry is, not what it offers.
	 */
	flavor?: Flavor
	/** Version of the implementation, if it reports one. */
	version?: string
	/** Version of the distribution spec the registry claims, if it reports one. */
	specVersion?: string
	/** Extensions the registry advertises, empty if it advertises none. */
	extensions: Extension[]
}

/** Name of the extension namespace of zot. */
export const ZotExtension = '_zot'

/**
 * Asks the registry what it can be asked for.
 *
 * The extensions it advertises are read first since they are a fact it states;
 * what is not advertised is probed, which is the only way to tell for the APIs
 * that predate the discovery.
 */
export async function featuresOf(transport: Transport, domain: string, extensions: Extension[]): Promise<Features> {
	const [search, catalog] = await Promise.all([
		searchOf(transport, domain, extensions), //
		catalogOf(transport, domain),
	])

	return { search, catalog }
}

async function searchOf(transport: Transport, domain: string, extensions: Extension[]): Promise<undefined | SearchDialect> {
	const advertised = extensions.some(e => e.name === ZotExtension && e.endpoints.some(p => p.endsWith('/ext/search')))
	if (advertised) {
		return 'zot'
	}

	// `/v1/search` is a leftover of the Docker Registry HTTP API V1 so it is
	// advertised nowhere; it has to be asked for.
	const res = await transport.fetch(`https://${domain}/v1/search?n=1`)
	return res.status === 200 ? 'v1' : undefined
}

async function catalogOf(transport: Transport, domain: string): Promise<undefined | boolean> {
	const res = await transport.fetch(`https://${domain}/v2/_catalog?n=1`)
	if (res.status === 200) {
		return true
	}
	if (res.status === 404) {
		return false
	}

	// It is served but it would not say what it holds.
	return undefined
}

/**
 * Guesses the implementation from a response of `GET /v2/`.
 * It is a fallback for the registries that advertise nothing.
 */
export function flavorOf(res: Response): undefined | Flavor {
	// zot allows the header its own client sends, whether or not the extensions
	// are enabled.
	if (res.headers.get('Access-Control-Allow-Headers')?.includes('X-ZOT-API-CLIENT')) {
		return 'zot'
	}

	// distribution sets it while Docker Hub, which serves distribution behind
	// it, does not; it is the only thing that tells them apart here.
	if (res.headers.get('X-Content-Type-Options') === 'nosniff' && res.headers.get('Docker-Distribution-Api-Version') !== null) {
		return 'distribution'
	}

	return undefined
}
