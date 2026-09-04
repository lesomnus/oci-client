/**
 * Media types of the Docker Registry HTTP API V2, which predates the OCI
 * image spec. A registry that serves images pushed by Docker still answers
 * with them, so they are listed to be recognized rather than to be pushed.
 *
 * @see {@link https://distribution.github.io/distribution/spec/manifest-v2-2/ | spec}
 */
export namespace docker {
	export namespace distribution {
		export const manifestV2 = 'application/vnd.docker.distribution.manifest.v2+json'
		export const manifestListV2 = 'application/vnd.docker.distribution.manifest.list.v2+json'

		/** @deprecated Schema 1 is deprecated by the registry it came from. */
		export const manifestV1 = 'application/vnd.docker.distribution.manifest.v1+json'
		/** @deprecated Schema 1 is deprecated by the registry it came from. */
		export const manifestV1Signed = 'application/vnd.docker.distribution.manifest.v1+prettyjws'
	}

	export namespace container {
		export const imageV1 = 'application/vnd.docker.container.image.v1+json'
	}

	export namespace image {
		export const rootfsDiffTarGzip = 'application/vnd.docker.image.rootfs.diff.tar.gzip'
		export const rootfsForeignDiffTarGzip = 'application/vnd.docker.image.rootfs.foreign.diff.tar.gzip'
	}

	export namespace plugin {
		export const v1 = 'application/vnd.docker.plugin.v1+json'
	}
}
