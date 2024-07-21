import { createHash } from 'node:crypto'

import { ClientV2 } from './client'
import Codes from './codes'
import { Digest } from './digest'
import { oci } from './media-types'
import { Accept, FetchTransport, Unsecure } from './transport'

function encodeString(data: string): Uint8Array {
	const encoder = new TextEncoder()
	return encoder.encode(data)
}

function hash(data: Uint8Array): Digest {
	const sha256 = createHash('sha256')
	sha256.update(data)
	const v = sha256.digest('hex')

	return new Digest('sha256', v)
}

function title(code: string, method: string, endpoint: string) {
	return `${code.padEnd('end-NNa'.length)} ${method.padStart('DELETE'.length)} ${endpoint}`
}

function toRecord<T extends { key: string }>(vs: T[]) {
	return vs.reduce(
		(o, { key, ...v }) => {
			o[key] = v
			return o
		},
		{} as Record<string, Omit<T, 'key'>>,
	)
}

describe.concurrent('api v2', async () => {
	const images = toRecord(
		[
			{
				key: 'v0.1.0',
				data: 'Revenge is a dish best served cold.',
			},
			{
				key: 'v0.2.0',
				data: 'Silly Caucasian girl likes to play with Samurai swords',
			},
			{
				key: 'v0.3.0',
				data: 'They will be things you will miss',
			},
		].map(init => {
			const bytes = encodeString(init.data)
			const digest = hash(bytes)
			return {
				...init,
				ref: init.key,
				bytes,
				digest: hash(bytes),
				manifest: {
					schemaVersion: 2,
					mediaType: oci.image.manifestV1,
					config: oci.empty,
					layers: [
						{
							mediaType: 'application/octet-stream',
							digest: digest.toString(),
							size: bytes.byteLength,
						},
					],
				},
			}
		}),
	)
	const artifacts = toRecord(
		['application/foo', 'application/bar'].map(key => {
			const manifest: oci.image.ManifestV1 = {
				schemaVersion: 2,
				mediaType: oci.image.manifestV1,
				artifactType: key,
				config: oci.empty,
				layers: [oci.empty],
				subject: (() => {
					const {
						bytes,
						digest,
						manifest: { mediaType },
					} = images['v0.1.0']
					return {
						mediaType,
						digest: digest.toString(),
						size: bytes.length,
					}
				})(),
			}
			const bytes = encodeString(JSON.stringify(manifest))
			const digest = hash(bytes)

			return { key, bytes, digest, manifest }
		}),
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
		await repo.manifests.put(image.ref, oci.image.manifestV1, JSON.stringify(image.manifest)).unwrap()
	}
	for (const artifact of Object.values(artifacts)) {
		await repo.manifests.put(artifact.digest, oci.image.manifestV1, artifact.bytes).unwrap()
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
	describe.concurrent(title('end-4a', 'POST', 'blobs/uploads'), () => {
		test('202', async () => {
			const req = client.repo('test/end-4a').blobs.uploadsInit()
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(202)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).not.to.be.empty
		})
	})
	describe.concurrent(title('end-4b', 'POST', 'blobs/uploads?digest=_'), () => {
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
	describe.concurrent(title('end-7', 'PUT', 'manifests/<reference>'), () => {
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
	describe.concurrent(title('end-8a', 'GET', 'tags/list'), () => {
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
			const req = client.repo('test/end-8a-not-exists').tags.list()
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.NameUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-8b', 'GET', 'tags/list?n=_&last=_'), () => {
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
			const req = client.repo('test/end-8b-not-exists').tags.list({ n: 2, last: 'v0.2.0' })
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.NameUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-9', 'DELETE', 'manifests/<reference>'), () => {
		test('202', async () => {
			const repo = client.repo('test/end-9')
			const image = images['v0.1.0']
			const { manifest } = image
			await repo.blobs.uploads(oci.empty.digest, Uint8Array.from([...'{}'].map(c => c.charCodeAt(0)))).unwrap()
			await repo.blobs.uploads(image.digest, image.bytes).unwrap()

			const bytes = encodeString(JSON.stringify(manifest))
			const digest = hash(bytes)
			await repo.manifests.put(digest, oci.image.manifestV1, JSON.stringify(image.manifest)).unwrap()

			const req = repo.manifests.delete(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(202)

			const result = res.unwrap()
			await expect(result).resolves.ok
		})
		test('404', async () => {
			const digest = hash(new Uint8Array())
			const req = repo.manifests.delete(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
		})
	})
	describe.concurrent(title('end-10', 'DELETE', 'blobs/<digest>'), () => {
		test('202', async () => {
			const repo = client.repo('test/end-10')
			const { digest, bytes } = images['v0.1.0']
			await repo.blobs.uploads(digest, bytes).unwrap()

			const req = repo.blobs.delete(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(202)

			const result = res.unwrap()
			await expect(result).resolves.ok
		})
		test('404', async () => {
			const digest = hash(new Uint8Array())
			const req = repo.blobs.delete(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
		})
	})
	describe.concurrent(title('end-12a', 'GET', 'referrers/<digest>'), () => {
		test('200', async () => {
			const { digest } = images['v0.1.0']
			const req = repo.referrers.get(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const result = res.unwrap()
			await expect(result).resolves.ok

			const v = await result
			const compare = <T extends (typeof v.manifests)[0]>(a: T, b: T) => a.mediaType.localeCompare(b.mediaType)

			expect(v.manifests).to.be.lengthOf(2)
			expect(v.manifests.sort(compare)).to.deep.equals(
				Object.values(artifacts)
					.map(v => ({
						mediaType: v.manifest.mediaType,
						digest: v.digest.toString(),
						size: v.bytes.length,
						artifactType: v.manifest.artifactType,
					}))
					.sort(compare),
			)
		})
		test('400', async () => {
			const req = repo.referrers.get('foo')
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(400)
		})
	})
	describe.concurrent(title('end-12b', 'GET', 'referrers/<digest>?artifactType=_'), () => {
		test('200', async () => {
			const { digest } = images['v0.1.0']
			const artifact = artifacts['application/foo']
			const req = repo.referrers.get(digest, { artifactType: artifact.manifest.artifactType })
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const result = res.unwrap()
			await expect(result).resolves.ok

			const v = await result
			expect(v.manifests).to.be.lengthOf(1)
			expect(v.manifests[0]).to.deep.equals({
				mediaType: artifact.manifest.mediaType,
				digest: artifact.digest.toString(),
				size: artifact.bytes.length,
				artifactType: artifact.manifest.artifactType,
			})
		})
	})
})
