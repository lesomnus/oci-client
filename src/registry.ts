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

export type Implementation = {
	/**
	 * Implementation on the other end, or `undefined` if there is nothing to
	 * tell it apart. The spec does not require a registry to identify itself so
	 * this is read from what it advertises and, failing that, guessed from how
	 * it answers; only the former is a fact the registry states.
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
