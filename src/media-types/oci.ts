import { mediaType } from '../media-type'

/**
 * @see {@link https://github.com/opencontainers/image-spec/blob/main/descriptor.md | spec}
 */
export type DescriptorV1 = {
	mediaType: string
	digest: string
	size: number
	urls?: number[]
	annotations?: Record<string, string>
	data?: string
	artifactType?: string
}

export namespace image {
	/**
	 * @see  {@link https://github.com/opencontainers/image-spec/blob/main/image-index.md | spec}
	 */
	export type IndexV1 = {
		schemaVersion: number
		mediaType: 'application/vnd.oci.image.index.v1+json'
		artifactType?: string
		manifests: (Omit<DescriptorV1, 'mediaType'> & {
			mediaType:
				| (string & {}) //
				| 'application/vnd.oci.image.manifest.v1+json'
			platform: {
				architecture:
					| (string & {})
					| '386'
					| 'amd64'
					| 'arm'
					| 'arm64'
					| 'loong64'
					| 'mips'
					| 'mips64'
					| 'mips64le'
					| 'mipsle'
					| 'ppc64'
					| 'ppc64le'
					| 'riscv64'
					| 's390x'
					| 'wasm'
				os:
					| (string & {})
					| 'aix'
					| 'android'
					| 'darwin'
					| 'dragonfly'
					| 'freebsd'
					| 'illumos'
					| 'ios'
					| 'js'
					| 'linux'
					| 'netbsd'
					| 'openbsd'
					| 'plan9'
					| 'solaris'
					| 'windows'
				'os.version'?: string
				'os.features'?: string[]
				variant?: string
			}
		})[]
		subject?: DescriptorV1
		annotations?: Record<string, string>
	}
	export const indexV1 = mediaType<IndexV1>('application/vnd.oci.image.index.v1+json')

	/**
	 * @see {@link https://github.com/opencontainers/image-spec/blob/main/manifest.md | spec}
	 */
	export type ManifestV1 = {
		schemaVersion: number
		mediaType: 'application/vnd.oci.image.manifest.v1+json'
		artifactType?: string
		config: DescriptorV1
		layers: (Omit<DescriptorV1, 'mediaType'> & {
			mediaType:
				| (string & {})
				| 'application/vnd.oci.image.layer.v1.tar'
				| 'application/vnd.oci.image.layer.v1.tar+gzip'
				| 'application/vnd.oci.image.layer.nondistributable.v1.tar'
				| 'application/vnd.oci.image.layer.nondistributable.v1.tar+gzip'
		})[]
		subject?: DescriptorV1
		annotations?: Record<string, string>
	}
	export const ManifestV1 = mediaType<ManifestV1>('application/vnd.oci.image.manifest.v1+json')
}
