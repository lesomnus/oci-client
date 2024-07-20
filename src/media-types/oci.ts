import { mediaType } from '../media-type'

/**
 * @see {@link https://github.com/opencontainers/image-spec/blob/main/manifest.md#guidance-for-an-empty-descriptor | Guidance for an Empty Descriptor}
 */
export const empty: DescriptorV1 = {
	mediaType: 'application/vnd.oci.empty.v1+json',
	digest: 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
	size: 2,
	data: 'e30=',
}

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
		/**
		 * Specifies the image manifest schema version.
		 * For this version of the specification, this MUST be 2 to ensure backward compatibility with older versions of Docker.
		 * The value of this field will not change.
		 * This field MAY be removed in a future version of the specification.
		 */
		schemaVersion: (number & {}) & 2
		mediaType: (string & {}) | 'application/vnd.oci.image.manifest.v1+json'
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
	export const manifestV1 = mediaType<ManifestV1>('application/vnd.oci.image.manifest.v1+json')
}
