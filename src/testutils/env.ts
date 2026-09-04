// `process` is not available in the browser so the values are injected by Vite.
// See `envPrefix` in the Vite config.
export const Domain = import.meta.env.REGISTRY_DOMAIN ?? 'registry:5000'
export const Kind = import.meta.env.REGISTRY_KIND ?? 'zot'

/**
 * Behaviors that not every registry has, either because the spec leaves them
 * optional or because the implementation does not comply with it.
 * The tests cannot expect them from every registry so they are declared here.
 */
export type Capabilities = {
	/**
	 * Answers `404 Not Found` for a repository that does not exist. `end-8`
	 * distribution answers `200 OK` with an empty list of tags instead.
	 */
	unknownRepository: boolean
	/**
	 * Mounts a blob from another repository. `end-11`
	 * The spec allows a registry to answer `202 Accepted` and have the blob
	 * uploaded to the session it opens instead.
	 */
	crossRepositoryMount: boolean
	/**
	 * Implements the Referrers API. `end-12`
	 * The spec allows a registry to answer `404 Not Found`, in which case the
	 * referrers are listed by the referrers tag schema.
	 */
	referrers: boolean
}

const Registries: Record<string, Capabilities | undefined> = {
	zot: {
		unknownRepository: true,
		crossRepositoryMount: true,
		referrers: true,
	},
	distribution: {
		unknownRepository: false,
		crossRepositoryMount: false,
		referrers: false,
	},
}

const capabilities = Registries[Kind]
if (capabilities === undefined) {
	throw new Error(`unknown registry: "${Kind}"; it must be one of ${Object.keys(Registries).join(', ')}`)
}

export const Supports: Capabilities = capabilities
