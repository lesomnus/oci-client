/**
 * Media types of a Notary Project signature.
 *
 * @see {@link https://github.com/notaryproject/specifications/blob/main/specs/signature-specification.md | spec}
 */
export namespace notary {
	/** Artifact type of the manifest that holds a signature. */
	export const signature = 'application/vnd.cncf.notary.signature'

	export const payloadV1 = 'application/vnd.cncf.notary.payload.v1+json'

	/**
	 * Media types of the layer that holds the signature envelope.
	 * Note that they are not vendor types although they are grouped here.
	 */
	export namespace envelope {
		/** JWS envelope. */
		export const jose = 'application/jose+json'
		/** COSE_Sign1 envelope. */
		export const cose = 'application/cose'
	}
}
