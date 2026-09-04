import type { sbom } from '~/media-types/sbom'
import { type MediaType, mediaType } from '~/media-types/t'
import type { helm } from '~/media-types/vnd/cncf/helm'
import type { notary } from '~/media-types/vnd/cncf/notary'
import type { cosign } from '~/media-types/vnd/dev/cosign'
import type { docker } from '~/media-types/vnd/docker'
import type { inToto } from '~/media-types/vnd/in-toto'
import type { wasm } from '~/media-types/vnd/wasm'

export const descriptorV1 = 'application/vnd.oci.descriptor.v1+json'
export const layoutHeaderV1 = 'application/vnd.oci.layout.header.v1+json'
export const emptyV1 = 'application/vnd.oci.empty.v1+json'

/**
 * @see {@link https://github.com/opencontainers/image-spec/blob/main/manifest.md#guidance-for-an-empty-descriptor | Guidance for an Empty Descriptor}
 */
export const empty: DescriptorV1 = {
	mediaType: emptyV1,
	digest: 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
	size: 2,
	data: 'e30=',
}

/**
 * Media types that are known to be the config of a manifest.
 * Any other media type is accepted; the listed ones are only known ones.
 */
export type ConfigMediaType =
	| (string & {})
	| typeof image.configV1
	| typeof emptyV1
	| typeof docker.container.imageV1
	| typeof helm.configV1
	| typeof wasm.configV1

/**
 * Media types that are known to be a layer of a manifest.
 * Any other media type is accepted; the listed ones are only known ones.
 */
export type LayerMediaType =
	| (string & {})
	| typeof image.layerV1
	| typeof image.layerV1Gzip
	| typeof image.layerV1Zstd
	| typeof image.layerNonDistributableV1
	| typeof image.layerNonDistributableV1Gzip
	| typeof image.layerNonDistributableV1Zstd
	| typeof emptyV1
	| typeof docker.image.rootfsDiffTarGzip
	| typeof docker.image.rootfsForeignDiffTarGzip
	| typeof helm.contentV1
	| typeof helm.provenanceV1
	| typeof wasm.contentLayerV1
	| typeof cosign.simpleSigningV1
	| typeof notary.envelope.jose
	| typeof notary.envelope.cose
	| typeof sbom.spdx.json
	| typeof sbom.spdx.tagValue
	| typeof sbom.cyclonedx.json
	| typeof sbom.cyclonedx.xml
	| typeof sbom.syft.json

/**
 * Artifact types that are known.
 * Any other media type is accepted; the listed ones are only known ones.
 *
 * @see {@link https://github.com/opencontainers/image-spec/blob/main/manifest.md#guidelines-for-artifact-usage | Guidelines for Artifact Usage}
 */
export type ArtifactType =
	| (string & {})
	| inToto.Attestation
	| typeof notary.signature
	| typeof cosign.artifact.sigV1
	| typeof cosign.artifact.sbomV1

/**
 * @see {@link https://github.com/opencontainers/image-spec/blob/main/descriptor.md | spec}
 */
export type DescriptorV1<M extends MediaType = string> = {
	mediaType: M
	digest: string
	size: number
	urls?: number[]
	annotations?: Record<string, string>
	data?: string
	artifactType?: ArtifactType
}

export namespace image {
	/**
	 * @see  {@link https://github.com/opencontainers/image-spec/blob/main/image-index.md | spec}
	 */
	export type IndexV1<M extends MediaType = (string & {}) | typeof manifestV1> = {
		schemaVersion: number
		mediaType: typeof indexV1
		artifactType?: ArtifactType
		manifests: (DescriptorV1<M> & {
			platform?: {
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
	export const indexV1 = mediaType({} as IndexV1, 'application/vnd.oci.image.index.v1+json')

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
		mediaType?: typeof manifestV1
		artifactType?: ArtifactType
		config: DescriptorV1<ConfigMediaType>
		layers: DescriptorV1<LayerMediaType>[]
		subject?: DescriptorV1<(string & {}) | typeof manifestV1>
		annotations?: Record<string, string>
	}
	export const manifestV1 = mediaType({} as ManifestV1, 'application/vnd.oci.image.manifest.v1+json')

	export const configV1 = 'application/vnd.oci.image.config.v1+json'

	export const layerV1 = 'application/vnd.oci.image.layer.v1.tar'
	export const layerV1Gzip = 'application/vnd.oci.image.layer.v1.tar+gzip'
	export const layerV1Zstd = 'application/vnd.oci.image.layer.v1.tar+zstd'

	/** @deprecated Non-distributable layers are deprecated by the image spec. */
	export const layerNonDistributableV1 = 'application/vnd.oci.image.layer.nondistributable.v1.tar'
	/** @deprecated Non-distributable layers are deprecated by the image spec. */
	export const layerNonDistributableV1Gzip = 'application/vnd.oci.image.layer.nondistributable.v1.tar+gzip'
	/** @deprecated Non-distributable layers are deprecated by the image spec. */
	export const layerNonDistributableV1Zstd = 'application/vnd.oci.image.layer.nondistributable.v1.tar+zstd'
}
