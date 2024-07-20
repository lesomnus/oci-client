import { ClientV2 } from './client'
import Codes from './codes'
import { Digest } from './digest'
import { oci } from './media-types'
import { Accept, FetchTransport, Unsecure } from './transport'

async function hash(data: Uint8Array): Promise<Digest> {
	const v = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')

	return new Digest('sha256', v)
}

function title(code: string, method: string, endpoint: string) {
	return `${code.padEnd('end-NNa'.length)} ${method.padEnd('POST'.length)} ${endpoint}`
}

type ImageInit = {
	ref: string
	data: string
}

describe.concurrent('api v2', async () => {
	const images = await Promise.all(
		(
			[
				{
					ref: 'v0.1.0',
					data: 'Revenge is a dish best served cold.',
				},
				{
					ref: 'v0.2.0',
					data: 'Silly Caucasian girl likes to play with Samurai swords',
				},
				{
					ref: 'v0.3.0',
					data: 'They will be things you will miss',
				},
			] as ImageInit[]
		).map(async init => {
			const encoder = new TextEncoder()
			const bytes = encoder.encode(init.data)
			return {
				...init,
				bytes,
				digest: await hash(bytes),
			}
		}),
	)
		.then(vs =>
			vs.map(init => {
				return {
					...init,
					manifest: {
						schemaVersion: 2,
						mediaType: oci.image.manifestV1 as string,
						config: oci.empty,
						layers: [
							{
								mediaType: 'application/octet-stream',
								digest: init.digest.toString(),
								size: init.bytes.byteLength,
							},
						],
					},
				}
			}),
		)
		.then(vs =>
			vs.reduce(
				(o, v) => {
					o[v.ref] = v
					return o
				},
				{} as Record<string, (typeof vs)[0]>,
			),
		)

	const Repo = 'test/test'
	const Domain = process.env.REGISTRY_DOMAIN ?? 'registry:5000'
	const client = new ClientV2(Domain, {
		transport: [
			new Unsecure(),
			new Accept({
				manifests: [oci.image.manifestV1, oci.image.indexV1],
			}),
			new FetchTransport(),
		],
	})

	// Push images:
	// - test/test:v0.1.0
	// - test/test:v0.2.0
	// - test/test:v0.3.0
	//
	// All images are Manifest v1.
	const repo = client.repo(Repo)
	await repo.blobs.uploads(oci.empty.digest, Uint8Array.from([...'{}'].map(c => c.charCodeAt(0)))).unwrap()
	for (const image of Object.values(images)) {
		await repo.blobs.uploads(image.digest, image.bytes).unwrap()
		await repo.manifests.put(image.ref, oci.image.manifestV1 as string, JSON.stringify(image.manifest)).unwrap()
	}

	test(title('end-1', 'GET', '/'), async () => {
		const req = client.ping()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
	})
	describe.concurrent(title('end-2', 'HEAD', 'blobs/<digest>'), () => {
		test('200', async () => {
			const { digest } = images['v0.1.0']
			const req = repo.blobs.exists(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)
			expect(res.ok).to.be.true
		})
		test('404', async () => {
			const req = repo.blobs.exists(await hash(new Uint8Array()))
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
			expect(res.ok).to.be.false
		})
	})
	describe.concurrent(title('end-2', 'GET', 'blobs/<digest>'), () => {
		test('200', async () => {
			const { data, digest } = images['v0.1.0']
			const req = repo.blobs.get(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const v = await res.raw.text()
			expect(v).to.eq(data)
		})
		test('404', async () => {
			const req = repo.blobs.get(await hash(new Uint8Array()))
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.BlobUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-3', 'HEAD', 'manifests/<references>'), async () => {
		test('200', async () => {
			const { ref } = images['v0.1.0']
			const req = repo.manifests.exists(ref)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)
			expect(res.ok).to.be.true
		})
		test('404', async () => {
			const req = repo.manifests.exists('not exists')
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
			expect(res.ok).to.be.false
		})
	})
	describe.concurrent(title('end-3', 'GET', 'manifests/<references>'), () => {
		test('200', async () => {
			const { ref, manifest } = images['v0.1.0']
			const req = repo.manifests.get(ref)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const result = res.unwrap()
			await expect(result).resolves.ok

			const v = await result
			expect(v).containSubset(manifest)
		})
		test('404', async () => {
			const req = repo.manifests.get('not exists')
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.ManifestUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-4b', 'POST', 'blobs/uploads?digest=_'), async () => {
		test('201', async () => {
			const { bytes, digest } = images['v0.1.0']
			const req = client.repo('example/end-4b').blobs.uploads(digest, bytes)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(201)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).not.to.be.empty
		})
	})
	describe.concurrent(title('end-7', 'PUT', 'manifests/<reference>'), async () => {
		test('201', async () => {
			const { ref, digest, bytes, manifest } = images['v0.1.0']
			const repo = client.repo('example/end-7')
			await repo.blobs.uploads(digest, bytes)
			await repo.blobs.uploads(oci.empty.digest, Uint8Array.from([...'{}'].map(c => c.charCodeAt(0))))

			const res = await repo.manifests.put(ref, manifest.mediaType, JSON.stringify(manifest))
			expect(res.raw.status).to.eq(201)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).not.to.be.empty
		})
	})
	describe.concurrent(title('end-8a', 'GET', 'tags/list'), async () => {
		test('200', async () => {
			const req = repo.tags.list()
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const result = res.unwrap()
			await expect(result).resolves.ok

			const v = await result
			expect(v.name).to.eq(Repo)
			expect(v.tags).to.eql(['v0.1.0', 'v0.2.0', 'v0.3.0'])
		})
		test('404', async () => {
			const req = client.repo('example/not-exists').tags.list()
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.NameUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-8b', 'GET', 'tags/list?n=_&last=_'), async () => {
		test('200', async () => {
			const req = repo.tags.list({ n: 2, last: 'v0.2.0' })
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const result = res.unwrap()
			await expect(result).resolves.ok

			const v = await result
			expect(v.name).to.eq(Repo)
			expect(v.tags).to.be.instanceOf(Array)
			expect(v.tags).to.eql(['v0.3.0'])
		})
		test('404', async () => {
			const req = client.repo('example/not-exists').tags.list({ n: 2, last: 'v0.2.0' })
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.NameUnknown)).to.be.true
		})
	})
})
