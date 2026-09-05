import { Chunk, ClientV2, Digest, ResError } from '~/index'
import { vnd } from '~/media-types'
import T from '~/testutils'

// These reach the registries that are actually out there, which is the only
// way to find what they do differently from the ones a test can run. They are
// off unless asked for since they leave the machine and are rate limited.
const enabled = T.env.Hosted
const credential = T.env.HubCredential

const encode = (s: string) => new TextEncoder().encode(s)

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Digest> {
	const v = await crypto.subtle.digest('SHA-256', bytes)
	const encoded = Array.from(new Uint8Array(v))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
	return new Digest('sha256', encoded)
}

describe.skipIf(!enabled)('hosted registries', () => {
	// Images that are not ours, read without a credential.
	describe.concurrent.each([
		{ domain: 'index.docker.io', name: 'library/alpine', reference: 'latest' },
		{ domain: 'ghcr.io', name: 'project-zot/zot', reference: 'latest' },
	])('$domain', ({ domain, name, reference }) => {
		const repo = new ClientV2(domain).repo(name)

		test('lists the tags', async () => {
			const v = await repo.tags.list({ n: 3 }).unwrap()
			expect(v.name).to.eq(name)
			expect(v.tags).not.to.be.empty
		})
		test('tells the manifest is there', async () => {
			const v = await repo.manifests.exists(reference)
			expect(v.ok).to.be.true
		})
		test('reads the manifest as what it is', async () => {
			const res = await repo.manifests.get(reference)
			expect(res.raw.status).to.eq(200)

			// Whichever it is, it has to be one of the two.
			const v = await res.unwrap()
			const index = v.as(vnd.oci.image.indexV1)
			const manifest = v.as(vnd.oci.image.manifestV1)
			expect(index ?? manifest).not.to.be.undefined
		})
		test('reads a blob the manifest points at', async () => {
			const v = await repo.manifests.get(reference).unwrap()

			// A tag of a multi-platform image resolves to an index, whose
			// entries are manifests rather than blobs.
			const index = v.as(vnd.oci.image.indexV1)
			const digest = index === undefined ? v.as(vnd.oci.image.manifestV1)?.config.digest : index.manifests[0].digest
			if (digest === undefined) {
				expect.unreachable()
			}

			const res = await repo.blobs.get(index === undefined ? digest : vnd.oci.empty.digest)
			expect([200, 404]).to.contain(res.raw.status)
		})
		test('reports the referrers', async () => {
			const res = await repo.referrers.get(`sha256:${'0'.repeat(64)}`)
			expect(res.raw.status).to.eq(200)

			const v = await res.unwrap()
			expect(v.manifests).to.be.instanceOf(Array)
		})
	})

	describe.skipIf(credential === undefined)('a repository that is not public', () => {
		const Repo = T.env.HubRepo
		const authorized = new ClientV2('index.docker.io', { credential }).repo(Repo)
		const anonymous = new ClientV2('index.docker.io').repo(Repo)

		const layer = encode('oci-client conformance test\n')
		let layerDigest: Digest
		let manifestBytes: Uint8Array<ArrayBuffer>

		beforeAll(async () => {
			layerDigest = await sha256(layer)
			const manifest = {
				schemaVersion: 2,
				mediaType: vnd.oci.image.manifestV1,
				config: vnd.oci.empty,
				layers: [{ mediaType: 'application/octet-stream', digest: layerDigest.toString(), size: layer.byteLength }],
			}
			manifestBytes = encode(JSON.stringify(manifest))

			await authorized.blobs.upload(vnd.oci.empty.digest, new Chunk(encode('{}'))).unwrap()
			await authorized.blobs.upload(layerDigest, new Chunk(layer)).unwrap()
			await authorized.manifests.put('v1', vnd.oci.image.manifestV1, manifestBytes).unwrap()
		})

		test('is served to the credential that owns it', async () => {
			const tags = await authorized.tags.list().unwrap()
			expect(tags.tags).to.contain('v1')

			const v = await authorized.manifests.get('v1').unwrap()
			expect(v.as(vnd.oci.image.manifestV1)?.layers[0].digest).to.eq(layerDigest.toString())
		})
		test('is not served to anyone else', async () => {
			expect((await anonymous.tags.list()).raw.status).to.eq(401)
			expect((await anonymous.manifests.get('v1')).raw.status).to.eq(401)

			// It cannot say whether it is there, which is not the same as
			// saying that it is not.
			await expect(anonymous.manifests.exists('v1')).rejects.toThrowError(ResError)
		})
		test('accepts a blob uploaded in a single request', async () => {
			const data = encode(`single ${Date.now()}\n`)
			const digest = await sha256(data)

			const res = await authorized.blobs.upload(digest, new Chunk(data))
			expect(res.raw.status).to.eq(201)
			expect((await authorized.blobs.exists(digest)).ok).to.be.true
		})
		test('deletes a manifest but not a blob', async () => {
			await authorized.manifests.put('to-delete', vnd.oci.image.manifestV1, manifestBytes).unwrap()
			expect((await authorized.manifests.delete('to-delete')).raw.status).to.eq(202)

			// Docker Hub does not serve `end-10`; the blob stays where it is.
			expect((await authorized.blobs.delete(layerDigest)).raw.status).to.eq(405)
		})
	})
})
