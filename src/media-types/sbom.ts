/**
 * Media types of the software bill of materials.
 *
 * They are grouped by the format rather than mirrored under `vnd` since SPDX
 * is not a vendor type.
 *
 * @see {@link https://github.com/sigstore/cosign/blob/main/pkg/types/media.go | the list cosign attaches}
 */
export namespace sbom {
	export namespace spdx {
		export const tagValue = 'text/spdx'
		export const json = 'text/spdx+json'
	}

	export namespace cyclonedx {
		export const json = 'application/vnd.cyclonedx+json'
		export const xml = 'application/vnd.cyclonedx+xml'
	}

	export namespace syft {
		export const json = 'application/vnd.syft+json'
	}
}
