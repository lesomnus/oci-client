/**
 * Media types of an in-toto attestation.
 *
 * @see {@link https://github.com/in-toto/attestation/blob/main/spec/v1/envelope.md | spec}
 */
export namespace inToto {
	/** Payload type of a DSSE envelope that holds a statement. */
	export const statement = 'application/vnd.in-toto+json'

	/**
	 * Artifact type of the manifest that holds an attestation, where
	 * `predicate` is the type of the predicate the statement makes.
	 */
	export type Attestation = `application/vnd.in-toto.${string}+dsse`

	export const provenance = 'application/vnd.in-toto.provenance+dsse'
	export const spdx = 'application/vnd.in-toto.spdx+dsse'
	export const vsa = 'application/vnd.in-toto.vsa+dsse'
}
