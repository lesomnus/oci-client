import { sha256 } from 'hash-wasm'

import { sbom, vnd } from './index'

describe('media types', () => {
	it('exposes the vendor trees', () => {
		expect(vnd.oci.image.manifestV1).to.eq('application/vnd.oci.image.manifest.v1+json')
		expect(vnd.cncf.helm.configV1).to.eq('application/vnd.cncf.helm.config.v1+json')
		expect(vnd.cncf.notary.signature).to.eq('application/vnd.cncf.notary.signature')
		expect(vnd.dev.cosign.simpleSigningV1).to.eq('application/vnd.dev.cosign.simplesigning.v1+json')
		expect(vnd.docker.distribution.manifestV2).to.eq('application/vnd.docker.distribution.manifest.v2+json')
		expect(vnd.inToto.statement).to.eq('application/vnd.in-toto+json')
		expect(vnd.wasm.contentLayerV1).to.eq('application/vnd.wasm.content.layer.v1+wasm')
		expect(sbom.spdx.json).to.eq('text/spdx+json')
		expect(sbom.cyclonedx.json).to.eq('application/vnd.cyclonedx+json')
	})

	// The empty descriptor is a constant of the spec so it has to describe the
	// very bytes it carries.
	describe('the empty descriptor', () => {
		const { empty } = vnd.oci
		const data = Uint8Array.from(atob(empty.data ?? ''), c => c.charCodeAt(0))

		it('carries "{}"', () => {
			expect(new TextDecoder().decode(data)).to.eq('{}')
		})
		it('has the size of the data', () => {
			expect(empty.size).to.eq(data.byteLength)
		})
		it('has the digest of the data', async () => {
			expect(empty.digest).to.eq(`sha256:${await sha256(data)}`)
		})
		it('has the media type of an empty descriptor', () => {
			expect(empty.mediaType).to.eq(vnd.oci.emptyV1)
		})
	})

	// An artifact type of in-toto embeds the type of its predicate.
	it('accepts an in-toto attestation as an artifact type', () => {
		const v: vnd.oci.ArtifactType = vnd.inToto.provenance
		expect(v).to.eq('application/vnd.in-toto.provenance+dsse')
	})
})
