// `process` is not available in the browser so the values are injected by Vite.
// See `envPrefix` in the Vite config.
export const Domain = import.meta.env.REGISTRY_DOMAIN ?? 'registry:5000'
export const Kind = import.meta.env.REGISTRY_KIND ?? 'zot'

/**
 * Whether to run the tests against the hosted registries, which are not run by
 * default since they reach out of the machine and are rate limited.
 */
export const Hosted = import.meta.env.REGISTRY_HOSTED === '1'

/**
 * Credential of the account that owns {@link HubRepo}, without which the tests
 * that write or read what is not public are skipped.
 */
export const HubCredential =
	import.meta.env.REGISTRY_HUB_USERNAME && import.meta.env.REGISTRY_HUB_TOKEN
		? { username: import.meta.env.REGISTRY_HUB_USERNAME, password: import.meta.env.REGISTRY_HUB_TOKEN }
		: undefined

/**
 * Credential that the local registry is configured to accept, which is a
 * fixture rather than a secret; see `.github/zot`.
 */
export const Credential = {
	username: import.meta.env.REGISTRY_USERNAME ?? 'tester',
	password: import.meta.env.REGISTRY_PASSWORD ?? 'tester-secret',
}

/**
 * Repository that the local registry serves only to {@link Credential}.
 * The tests that use it are skipped where the registry does not protect it.
 */
export const PrivateRepo = import.meta.env.REGISTRY_PRIVATE_REPO ?? 'private/thing'

/** Private repository on Docker Hub that the tests push to and read back. */
export const HubRepo = import.meta.env.REGISTRY_HUB_REPO ?? 'lesomnus/oci-client-test'

/**
 * Credential for ghcr.io, which is the token a workflow is given rather than
 * one that is held anywhere. Without it the tests that write are skipped.
 */
export const GhcrCredential =
	import.meta.env.REGISTRY_GHCR_USERNAME && import.meta.env.REGISTRY_GHCR_TOKEN
		? { username: import.meta.env.REGISTRY_GHCR_USERNAME, password: import.meta.env.REGISTRY_GHCR_TOKEN }
		: undefined

/** Repository on ghcr.io that the tests push to. */
export const GhcrRepo = import.meta.env.REGISTRY_GHCR_REPO ?? 'lesomnus/oci-client-test'

/**
 * Behaviors that not every registry has, either because the spec leaves them
 * optional or because the implementation does not comply with it.
 * The tests cannot expect them from every registry so they are declared here.
 *
 * Note that whether the Referrers API is implemented is not declared; it is
 * probed by the "OCI-Subject" header that a registry indexing a subject reports.
 */
export type Capabilities = {
	/**
	 * Answers `416 Range Not Satisfiable` for a chunk uploaded out of order. `end-5`
	 * distribution v2 accepts it with `202 Accepted` instead.
	 */
	outOfOrderChunk: boolean
	/**
	 * Lists the tags in lexical order. `end-8a`
	 * distribution v2 lists them in the order they were pushed.
	 */
	sortedTags: boolean
	/**
	 * Paginates the tags by "n" and "last". `end-8b`
	 * distribution v2 ignores both and lists every tag.
	 */
	tagPagination: boolean
	/**
	 * Answers `404 Not Found` for a repository that does not exist. `end-8b`
	 * distribution v3 answers `200 OK` with `"tags": null` when the query is
	 * paginated, although it answers `404 Not Found` when it is not.
	 */
	unknownRepository: boolean
}

const Registries: Record<string, Capabilities | undefined> = {
	'zot': {
		outOfOrderChunk: true,
		sortedTags: true,
		tagPagination: true,
		unknownRepository: true,
	},
	'distribution-v2': {
		outOfOrderChunk: false,
		sortedTags: false,
		tagPagination: false,
		unknownRepository: true,
	},
	'distribution-v3': {
		outOfOrderChunk: true,
		sortedTags: true,
		tagPagination: true,
		unknownRepository: false,
	},
}

const capabilities = Registries[Kind]
if (capabilities === undefined) {
	throw new Error(`unknown registry: "${Kind}"; it must be one of ${Object.keys(Registries).join(', ')}`)
}

export const Supports: Capabilities = capabilities
