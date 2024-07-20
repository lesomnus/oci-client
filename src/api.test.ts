import { ClientV2 } from './client'
import { Digest } from './digest'
import { oci } from './media-types'
import { Ref } from './ref'
import { Accept, FetchTransport, Unsecure } from './transport'

async function hash(data: Uint8Array): Promise<Digest> {
	const v = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')

	return new Digest('sha256', v)
}

describe.concurrent('api v2', () => {
	const Domain = 'registry:5000'
	const client = new ClientV2(Domain, {
		transport: [
			new Unsecure(),
			new Accept({
				manifests: [oci.image.indexV1],
			}),
			new FetchTransport(),
		],
	})

	test('end-1   GET', async () => {
		const req = client.ping()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
	})
	test('end-2   HEAD blobs/<digest>', async () => {
		// manifest of library/busybox:1.36-musl for linux/amd64
		const digest = 'sha256:6d9a2e77c3b19944a28c3922f5715ede91c1ae869d91edf5f6adf88ed54e97cf'
		const req = client.repo('library/busybox').blobs.exists(digest)
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(res.ok).to.be.true
	})
	test('end-2   GET blobs/<digest>', async () => {
		// manifest of library/busybox:1.36-musl for linux/amd64
		const digest = 'sha256:6d9a2e77c3b19944a28c3922f5715ede91c1ae869d91edf5f6adf88ed54e97cf'
		const req = client.repo('library/busybox').blobs.get(digest)
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)

		const v = (await res.raw.json()) as oci.image.ManifestV1
		expect(v.layers).to.have.length(1)
		expect(v.layers[0]).to.eql({
			mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
			digest: 'sha256:da76cf628912174a928f788a59ff847a686ce63d9a86ca3ece325fbfc8443b99',
			size: 852608,
		})
	})
	test('end-3   GET  manifests/<references>', async () => {
		const req = client.repo('library/busybox').manifests.get('1.36-musl')
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)

		const result = res.unwrap()
		await expect(result).resolves.ok

		const opaque = await result
		expect(opaque.as(oci.image.indexV1)).not.to.be.undefined
	})
	test('end-3   HEAD manifests/<references>', async () => {
		const req = client.repo('library/busybox').manifests.exists('1.36-musl')
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(res.ok).to.be.true
	})
	test('end-4b  POST blobs/uploads?digest=_', async () => {
		const data = crypto.getRandomValues(new Uint8Array(256))
		const digest = await hash(data)

		const req = client.repo('example/repo').blobs.uploads(digest, data)
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(201)
		await expect(res.unwrap()).resolves.ok

		const v = await res.unwrap()
		expect(v.location).not.to.be.empty
	})
	test('end-7   PUT  manifests/<reference>', async () => {
		const Repo = 'example/end-7'
		const Ref = 'hello'

		const data = crypto.getRandomValues(new Uint8Array(256))
		const digest = await hash(data)
		await client.repo(Repo).blobs.uploads(digest, data)
		await client.repo(Repo).blobs.uploads(oci.empty.digest, Uint8Array.from([...'{}'].map(c => c.charCodeAt(0))))

		const manifest: oci.image.ManifestV1 = {
			schemaVersion: 2,
			mediaType: oci.image.ManifestV1 as string,
			config: oci.empty,
			layers: [
				{
					mediaType: 'application/octet-stream',
					digest: digest.toString(),
					size: data.byteLength,
				},
			],
		}

		const res = await client.repo(Repo).manifests.put(Ref, oci.image.ManifestV1 as string, JSON.stringify(manifest))
		expect(res.raw.status).to.eq(201)
		await expect(res.unwrap()).resolves.ok

		const v = await res.unwrap()
		expect(v.location).not.to.be.empty
	})
	test('end-8a  GET  tags/list', async () => {
		const req = client.repo('library/busybox').tags.list()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)

		const result = res.unwrap()
		await expect(result).resolves.ok

		const v = await result
		expect(v.name).to.eq('library/busybox')
		expect(v.tags).to.eql(['1.34-musl', '1.35-musl', '1.36-musl'])
	})
	test('end-8b  GET  tags/list?n=_&last=_', async () => {
		const req = client.repo(new Ref('library/busybox')).tags.list({
			n: 2,
			last: '1.35-musl',
		})
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)

		const result = res.unwrap()
		await expect(result).resolves.ok

		const v = await result
		expect(v.name).to.eq('library/busybox')
		expect(v.tags).to.be.instanceOf(Array)
		expect(v.tags).to.eql(['1.36-musl'])
	})
})
