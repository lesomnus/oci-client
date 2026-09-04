/**
 * Media types of a Sigstore signature made by *cosign*.
 *
 * @see {@link https://github.com/sigstore/cosign/blob/main/specs/SIGNATURE_SPEC.md | spec}
 */
export namespace cosign {
	/** Media type of the layer that holds the signature payload. */
	export const simpleSigningV1 = 'application/vnd.dev.cosign.simplesigning.v1+json'

	/** Artifact types of the manifest that refers to a subject. */
	export namespace artifact {
		export const sigV1 = 'application/vnd.dev.cosign.artifact.sig.v1+json'
		export const sbomV1 = 'application/vnd.dev.cosign.artifact.sbom.v1+json'
	}
}
