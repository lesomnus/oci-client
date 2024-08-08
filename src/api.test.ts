import { createSHA256 } from 'hash-wasm'
import type { TaskContext } from 'vitest'

import { Chunk } from './chunk'
import { ClientV2 } from './client-v2'
import Codes from './codes'
import { oci } from './media-types'
import * as T from './testutils'
import { Accept, FetchTransport, Unsecure } from './transport'

function title(code: string, method: string, endpoint: string) {
	return `${code.padEnd('end-NNa'.length)} ${method.padStart('DELETE'.length)} ${endpoint}`
}

describe.concurrent('api v2', async () => {
	const client = new ClientV2(T.env.Domain, {
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
	const Repo = 'test/test'
	const repo = client.repo(Repo)
	await repo.blobs.upload(oci.empty.digest, T.asset.EmptyObjectData).unwrap()
	for (const image of Object.values(T.asset.Images)) {
		await repo.blobs.upload(image.digest, image.chunk).unwrap()
		await repo.manifests.put(image.ref, oci.image.manifestV1, JSON.stringify(image.manifest)).unwrap()
	}
	for (const artifact of Object.values(T.asset.Artifacts)) {
		await repo.manifests.put(artifact.digest, oci.image.manifestV1, artifact.bytes).unwrap()
	}

	const getRepo = (ctx: TaskContext, name?: string) =>
		client.repo(`test-${ctx.task.file.projectName}/${name ?? ctx.task.suite?.name.slice(0, 7).trim()}`)

	test(title('end-1', 'GET', '/'), async () => {
		const req = client.ping()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
	})
	describe.concurrent(title('end-2', 'HEAD', 'blobs/<digest>'), () => {
		test('200', async () => {
			const { digest } = T.asset.Images['v0.1.0']

			const req = repo.blobs.exists(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)
			expect(res.ok).to.be.true
		})
		test('404', async () => {
			const req = repo.blobs.exists(T.asset.HashOfNotExists)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
			expect(res.ok).to.be.false
		})
	})
	describe.concurrent(title('end-2', 'GET', 'blobs/<digest>'), () => {
		test('200', async () => {
			const { data, digest } = T.asset.Images['v0.1.0']

			const req = repo.blobs.get(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const v = await res.raw.text()
			expect(v).to.eq(data)
		})
		test('404', async () => {
			const req = repo.blobs.get(T.asset.HashOfNotExists)
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
			const { ref } = T.asset.Images['v0.1.0']

			const req = repo.manifests.exists(ref)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)
			expect(res.ok).to.be.true
		})
		test('404', async () => {
			const req = repo.manifests.exists('not-exists')
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
			expect(res.ok).to.be.false
		})
	})
	describe.concurrent(title('end-3', 'GET', 'manifests/<references>'), () => {
		test('200', async () => {
			const { ref, manifest } = T.asset.Images['v0.1.0']

			const req = repo.manifests.get(ref)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(200)

			const result = res.unwrap()
			await expect(result).resolves.ok

			const opaque = await result
			const v = opaque.as(oci.image.manifestV1)
			expect(v).not.to.be.undefined
			expect(v).containSubset(manifest)
		})
		test('404', async () => {
			const req = repo.manifests.get('not-exists')
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.ManifestUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-4a', 'POST', 'blobs/uploads'), () => {
		test('202', async ctx => {
			const repo = getRepo(ctx)
			const req = repo.blobs.initUpload()
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(202)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).to.be.exist
		})
	})
	describe.concurrent(title('end-4b', 'POST', 'blobs/uploads?digest=_'), () => {
		test('201', async ctx => {
			const { chunk, digest } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const req = repo.blobs.upload(digest, chunk)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(201)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).to.be.exist
		})
	})
	describe.concurrent(title('end-5', 'PATCH', 'blobs/uploads/<reference>'), () => {
		test('202', async ctx => {
			const { chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const { location } = await repo.blobs.initUpload().unwrap()

			const req = repo.blobs.uploadChunk(location, chunk)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(202)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).to.be.exist
		})
		test('416', async ctx => {
			const { chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const { location } = await repo.blobs.initUpload().unwrap()

			const req = repo.blobs.uploadChunk(location, chunk.withPos(1))
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(416)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.BlobUploadInvalid)).to.be.true
		})
	})
	describe.concurrent(title('end-6', 'PUT', 'blobs/uploads/<reference>?digest=_'), () => {
		test('201', async ctx => {
			const { digest, chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const { location } = await repo.blobs.initUpload().unwrap()

			const req = repo.blobs.closeUpload(location, digest, chunk)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(201)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).to.be.exist
		})
	})
	describe.concurrent(title('end-7', 'PUT', 'manifests/<reference>'), () => {
		test('201', async ctx => {
			const { ref, digest, chunk, manifest } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			await repo.blobs.upload(digest, chunk)
			await repo.blobs.upload(oci.empty.digest, T.asset.EmptyObjectData)

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
		test('404', async ctx => {
			const repo = getRepo(ctx, 'end-8b-not-exists')
			const req = repo.tags.list({ n: 2, last: 'v0.2.0' })
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)

			const errors = await res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.NameUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-9', 'DELETE', 'manifests/<reference>'), () => {
		test('202', async ctx => {
			const image = T.asset.Images['v0.1.0']
			const { manifest } = image

			const repo = getRepo(ctx)
			await repo.blobs.upload(oci.empty.digest, T.asset.EmptyObjectData).unwrap()
			await repo.blobs.upload(image.digest, image.chunk).unwrap()

			const bytes = T.encodeString(JSON.stringify(manifest))
			const digest = await T.hash(bytes)
			await repo.manifests.put(digest, oci.image.manifestV1, JSON.stringify(image.manifest)).unwrap()

			const req = repo.manifests.delete(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(202)

			const result = res.unwrap()
			await expect(result).resolves.ok
		})
		test('404', async () => {
			const req = repo.manifests.delete(T.asset.HashOfNotExists)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
		})
	})
	describe.concurrent(title('end-10', 'DELETE', 'blobs/<digest>'), () => {
		test('202', async ctx => {
			const { digest, chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			await repo.blobs.upload(digest, chunk).unwrap()

			const req = repo.blobs.delete(digest)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(202)

			const result = res.unwrap()
			await expect(result).resolves.ok
		})
		test('404', async () => {
			const req = repo.blobs.delete(T.asset.HashOfNotExists)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(404)
		})
	})
	describe.concurrent(title('end-11', 'POST', 'blobs/uploads/?mount=<digest>&from=<other_name>'), () => {
		test('201', async ctx => {
			const { digest, ref } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const req = repo.blobs.mount(digest, ref)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(201)

			const result = res.unwrap()
			await expect(result).resolves.ok
		})
	})
	describe.concurrent(title('end-12a', 'GET', 'referrers/<digest>'), () => {
		test('200', async () => {
			const { digest } = T.asset.Images['v0.1.0']

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
				Object.values(T.asset.Artifacts)
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
			const { digest } = T.asset.Images['v0.1.0']
			const artifact = T.asset.Artifacts['application/foo']

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
	describe.concurrent(title('end-13', 'GET', 'blobs/uploads/<reference>'), () => {
		test('204', async ctx => {
			const repo = getRepo(ctx)
			let { location } = await repo.blobs.initUpload().unwrap()
			;({ location } = await repo.blobs.uploadChunk(location, new Chunk(Uint8Array.from([1, 2, 3]))).unwrap())

			const req = repo.blobs.getUploadStatus(location)
			await expect(req).resolves.ok

			const res = await req
			expect(res.raw.status).to.eq(204)
			await expect(res.unwrap()).resolves.ok

			const v = await res.unwrap()
			expect(v.location).to.be.exist
			expect(v.range.pos).to.eq(0)
			expect(v.range.length).to.eq(3)
		})
	})

	test('BlobsV2Upload', async ctx => {
		const { bytes } = T.asset.Images['v0.1.0']
		const hasher = await createSHA256()
		const chunkSize = Math.floor(bytes.length / 3)

		const repo = getRepo(ctx, 'blobs-v2-upload')
		const upload = repo.blobs.startUpload({ ...hasher, name: 'sha256' })
		await upload.write(bytes.subarray(0, chunkSize))
		await upload.write(bytes.subarray(chunkSize, chunkSize * 2))
		await upload.write(bytes.subarray(chunkSize * 2))
		await upload.close()
	})
})
