import { createSHA256 } from 'hash-wasm'
import type { TestContext } from 'vitest'

import {
	Accept,
	Chunk,
	ClientV2,
	Codes,
	FetchTransport,
	type Hasher,
	ManifestMediaTypes,
	type ReqInit,
	type Transport,
	Unsecure,
} from '#src/index'
import { vnd } from '#src/media-types'
import T from '#src/testutils'

function title(code: string, method: string, endpoint: string) {
	return `${code.padEnd('end-NNa'.length)} ${method.padStart('DELETE'.length)} ${endpoint}`
}

describe.concurrent('api v2', async () => {
	const client = new ClientV2(T.env.Domain, {
		transport: [
			new Unsecure(),
			new Accept({
				manifests: [vnd.oci.image.manifestV1, vnd.oci.image.indexV1],
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
	await repo.blobs.upload(vnd.oci.empty.digest, T.asset.EmptyObjectData).unwrap()
	for (const image of Object.values(T.asset.Images)) {
		await repo.blobs.upload(image.digest, image.chunk).unwrap()
		await repo.manifests.put(image.ref, vnd.oci.image.manifestV1, image.manifestBytes).unwrap()
	}

	// A registry that implements the Referrers API reports the subject it has
	// indexed. It is probed rather than declared so that the tests follow what
	// the registry actually does.
	let supportsReferrers = false
	for (const artifact of Object.values(T.asset.Artifacts)) {
		const res = await repo.manifests.put(artifact.digest, vnd.oci.image.manifestV1, artifact.bytes)
		res.unwrap()
		supportsReferrers ||= res.raw.headers.get('OCI-Subject') !== null
	}

	const getRepo = (ctx: TestContext, name?: string) =>
		client.repo(`test-${ctx.task.file.projectName}/${name ?? ctx.task.suite?.name.slice(0, 7).trim()}`)

	test(title('end-1', 'GET', '/'), async () => {
		const res = await client.ping()
		expect(res.raw.status).to.eq(200)
	})
	describe.concurrent(title('end-2', 'HEAD', 'blobs/<digest>'), () => {
		test('200', async () => {
			const { digest } = T.asset.Images['v0.1.0']

			const res = await repo.blobs.exists(digest)
			expect(res.raw.status).to.eq(200)
			expect(res.ok).to.be.true
		})
		test('404', async () => {
			const res = await repo.blobs.exists(T.asset.HashOfNotExists)
			expect(res.raw.status).to.eq(404)
			expect(res.ok).to.be.false
		})
	})
	describe.concurrent(title('end-2', 'GET', 'blobs/<digest>'), () => {
		test('200', async () => {
			const { data, digest } = T.asset.Images['v0.1.0']

			const res = await repo.blobs.get(digest)
			expect(res.raw.status).to.eq(200)

			const v = await res.raw.text()
			expect(v).to.eq(data)
		})
		test('404', async () => {
			const res = await repo.blobs.get(T.asset.HashOfNotExists)
			expect(res.raw.status).to.eq(404)

			const errors = res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.BlobUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-3', 'HEAD', 'manifests/<references>'), async () => {
		test('200', async () => {
			const { ref } = T.asset.Images['v0.1.0']

			const res = await repo.manifests.exists(ref)
			expect(res.raw.status).to.eq(200)
			expect(res.ok).to.be.true
		})
		test('404', async () => {
			const res = await repo.manifests.exists('not-exists')
			expect(res.raw.status).to.eq(404)
			expect(res.ok).to.be.false
		})
	})
	describe.concurrent(title('end-3', 'GET', 'manifests/<references>'), () => {
		test('200', async () => {
			const { ref, manifest } = T.asset.Images['v0.1.0']

			const res = await repo.manifests.get(ref)
			expect(res.raw.status).to.eq(200)

			const opaque = res.unwrap()
			const v = opaque.as(vnd.oci.image.manifestV1)
			expect(v).not.to.be.undefined
			expect(v).containSubset(manifest)
		})
		test('404', async () => {
			const res = await repo.manifests.get('not-exists')
			expect(res.raw.status).to.eq(404)

			const errors = res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.ManifestUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-4a', 'POST', 'blobs/uploads'), () => {
		test('202', async ctx => {
			const repo = getRepo(ctx)
			const res = await repo.blobs.initUpload()
			expect(res.raw.status).to.eq(202)
			const v = res.unwrap()
			expect(v.location).to.be.exist
		})
	})
	describe.concurrent(title('end-4b', 'POST', 'blobs/uploads?digest=_'), () => {
		test('201', async ctx => {
			const { chunk, digest } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const res = await repo.blobs.upload(digest, chunk)
			expect(res.raw.status).to.eq(201)
			const v = res.unwrap()
			expect(v.location).to.be.exist
		})
	})
	describe.concurrent(title('end-5', 'PATCH', 'blobs/uploads/<reference>'), () => {
		test('202', async ctx => {
			const { chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const { location } = await repo.blobs.initUpload().unwrap()

			const res = await repo.blobs.uploadChunk(location, chunk)
			expect(res.raw.status).to.eq(202)
			const v = res.unwrap()
			expect(v.location).to.be.exist
		})
		test.runIf(T.env.Supports.outOfOrderChunk)('416', async ctx => {
			const { chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const { location } = await repo.blobs.initUpload().unwrap()

			const res = await repo.blobs.uploadChunk(location, chunk.withPos(1))
			expect(res.raw.status).to.eq(416)

			// The spec does not define which code is reported for it; zot says
			// `BLOB_UPLOAD_INVALID` while distribution says `RANGE_INVALID`.
			const errors = res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors).not.to.be.empty
		})
	})
	describe.concurrent(title('end-6', 'PUT', 'blobs/uploads/<reference>?digest=_'), () => {
		test('201', async ctx => {
			const { digest, chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			const { location } = await repo.blobs.initUpload().unwrap()

			const res = await repo.blobs.closeUpload(location, digest, chunk)
			expect(res.raw.status).to.eq(201)
			const v = res.unwrap()
			expect(v.location).to.be.exist
		})
	})
	describe.concurrent(title('end-7', 'PUT', 'manifests/<reference>'), () => {
		test('201', async ctx => {
			const { ref, digest, chunk, manifest } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			await repo.blobs.upload(digest, chunk).unwrap()
			await repo.blobs.upload(vnd.oci.empty.digest, T.asset.EmptyObjectData).unwrap()

			const res = await repo.manifests.put(ref, manifest.mediaType, JSON.stringify(manifest))
			expect(res.raw.status).to.eq(201)
			const v = res.unwrap()
			expect(v.location).to.be.instanceOf(URL)
		})
	})
	describe.concurrent(title('end-8a', 'GET', 'tags/list'), () => {
		test('200', async () => {
			const res = await repo.tags.list()
			expect(res.raw.status).to.eq(200)

			const v = res.unwrap()
			expect(v.name).to.eq(Repo)
			expect(v.tags.slice().sort()).to.eql(['v0.1.0', 'v0.2.0', 'v0.3.0'])
			if (T.env.Supports.sortedTags) {
				expect(v.tags).to.eql(['v0.1.0', 'v0.2.0', 'v0.3.0'])
			}
		})
		test('404', async () => {
			const res = await client.repo('test/end-8a-not-exists').tags.list()
			expect(res.raw.status).to.eq(404)

			const errors = res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.NameUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-8b', 'GET', 'tags/list?n=_&last=_'), () => {
		test.runIf(T.env.Supports.tagPagination)('200', async () => {
			const res = await repo.tags.list({ n: 2, last: 'v0.2.0' })
			expect(res.raw.status).to.eq(200)

			const v = res.unwrap()
			expect(v.name).to.eq(Repo)
			expect(v.tags).to.be.instanceOf(Array)
			expect(v.tags).to.eql(['v0.3.0'])
		})
		test.runIf(T.env.Supports.unknownRepository)('404', async ctx => {
			const repo = getRepo(ctx, 'end-8b-not-exists')
			const res = await repo.tags.list({ n: 2, last: 'v0.2.0' })
			expect(res.raw.status).to.eq(404)

			const errors = res.unwrapOr((_, errors) => errors)
			if (!Array.isArray(errors)) expect.unreachable()
			expect(errors.some(err => err.code === Codes.NameUnknown)).to.be.true
		})
	})
	describe.concurrent(title('end-9', 'DELETE', 'manifests/<reference>'), () => {
		test('202', async ctx => {
			const image = T.asset.Images['v0.1.0']
			const { manifest } = image

			const repo = getRepo(ctx)
			await repo.blobs.upload(vnd.oci.empty.digest, T.asset.EmptyObjectData).unwrap()
			await repo.blobs.upload(image.digest, image.chunk).unwrap()

			const bytes = T.encodeString(JSON.stringify(manifest))
			const digest = await T.hash(bytes)
			await repo.manifests.put(digest, vnd.oci.image.manifestV1, JSON.stringify(image.manifest)).unwrap()

			const res = await repo.manifests.delete(digest)
			expect(res.raw.status).to.eq(202)

			res.unwrap()
		})
		test('404', async () => {
			const res = await repo.manifests.delete(T.asset.HashOfNotExists)
			expect(res.raw.status).to.eq(404)
		})
	})
	describe.concurrent(title('end-10', 'DELETE', 'blobs/<digest>'), () => {
		test('202', async ctx => {
			const { digest, chunk } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			await repo.blobs.upload(digest, chunk).unwrap()

			const res = await repo.blobs.delete(digest)
			expect(res.raw.status).to.eq(202)

			res.unwrap()
		})
		test('404', async () => {
			const res = await repo.blobs.delete(T.asset.HashOfNotExists)
			expect(res.raw.status).to.eq(404)
		})
	})
	describe.concurrent(title('end-11', 'POST', 'blobs/uploads/?mount=<digest>&from=<other_name>'), () => {
		test('201', async ctx => {
			const { digest } = T.asset.Images['v0.1.0']

			const repo = getRepo(ctx)
			// `from` is the repository that holds the blob, not a reference of it.
			const res = await repo.blobs.mount(digest, Repo)
			expect(res.raw.status).to.eq(201)

			res.unwrap()
		})
	})
	describe.concurrent(title('end-12a', 'GET', 'referrers/<digest>'), () => {
		test('200', async () => {
			const { manifestDigest } = T.asset.Images['v0.1.0']

			const res = await repo.referrers.get(manifestDigest)
			expect(res.raw.status).to.eq(200)

			const v = res.unwrap()
			if (!supportsReferrers) {
				// The referrers are listed by the tag schema, which nothing
				// maintains here, so there is none to be found.
				expect(v.manifests).to.be.empty
				return
			}

			expect(v.manifests).to.be.lengthOf(2)
			expect(
				v.manifests
					.slice()
					.map(v => v.digest)
					.sort(),
			).to.eql(
				Object.values(T.asset.Artifacts)
					.map(v => v.digest.toString())
					.sort(),
			)
		})
		test.runIf(supportsReferrers)('400', async () => {
			// It is a well-formed digest but the registry does not know the algorithm.
			const res = await repo.referrers.get('foo:bar')
			expect(res.raw.status).to.eq(400)
		})
	})
	describe.concurrent(title('end-12b', 'GET', 'referrers/<digest>?artifactType=_'), () => {
		test('200', async () => {
			const { manifestDigest } = T.asset.Images['v0.1.0']
			const artifact = T.asset.Artifacts['application/foo']

			const res = await repo.referrers.get(manifestDigest, { artifactType: artifact.manifest.artifactType })
			expect(res.raw.status).to.eq(200)

			const v = res.unwrap()
			if (!supportsReferrers) {
				expect(v.manifests).to.be.empty
				return
			}

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

			const res = await repo.blobs.getUploadStatus(location)
			expect(res.raw.status).to.eq(204)
			const v = res.unwrap()
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

describe('ManifestsApiV2 accepts', () => {
	// `ghcr.io` answers `404 Not Found` for a manifest it cannot represent as
	// one of the accepted media types, so what can be read is always stated.
	const record = () => {
		const seen: (null | string)[] = []
		const transport: Transport = {
			fetch(resource, init) {
				seen.push(new Request(resource instanceof URL ? resource.toString() : resource, init).headers.get('Accept'))
				return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
			},
		}
		return [new ClientV2('x.com', { transport }).repo('foo/bar'), seen] as const
	}

	it('states the manifest media types it can read', async () => {
		const [repo, seen] = record()
		await repo.manifests.get('latest').unwrap()

		const [accept] = seen
		expect(accept).to.contain(vnd.oci.image.manifestV1)
		expect(accept).to.contain(vnd.oci.image.indexV1)
		// A registry serving what Docker pushed answers with these.
		expect(accept).to.contain(vnd.docker.distribution.manifestV2)
		expect(accept).to.contain(vnd.docker.distribution.manifestListV2)
	})
	it('states them on a "HEAD" as well', async () => {
		const [repo, seen] = record()
		await repo.manifests.exists('latest')
		expect(seen[0]).to.contain(vnd.oci.image.manifestV1)
	})
	it('is overridden by the `Accept` middleware', async () => {
		const seen: (null | string)[] = []
		const transport: Transport = {
			fetch(resource, init) {
				seen.push(new Request(resource instanceof URL ? resource.toString() : resource, init).headers.get('Accept'))
				return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
			},
		}
		const client = new ClientV2('x.com', {
			transport: [new Accept({ manifests: [vnd.oci.image.manifestV1] }), transport],
		})

		await client.repo('foo/bar').manifests.get('latest').unwrap()
		expect(seen[0]).to.eq(vnd.oci.image.manifestV1)
	})

	// Over 128 bytes an "Accept" is no longer a CORS-safelisted request header,
	// so a browser preflights the request and a registry that does not allow
	// "accept" in `Access-Control-Allow-Headers`, as zot does not, rejects it.
	// The media types are ASCII so the length of the value is its size.
	const CorsSafelistLimit = 128

	it('offers more than a browser can send without a preflight', () => {
		// No subset both fits and reads every registry correctly, so the list
		// stays correct and the narrowing below is offered instead.
		expect(ManifestMediaTypes.join(', ').length).toBeGreaterThan(CorsSafelistLimit)
	})
	it('is narrowed by the `accept` option', async () => {
		const accept = [vnd.oci.image.indexV1, vnd.docker.distribution.manifestListV2]
		expect(accept.join(', ').length).toBeLessThanOrEqual(CorsSafelistLimit)

		const [repo, seen] = record()
		await repo.manifests.get('latest', { accept }).unwrap()
		expect(seen[0]).to.eq(accept.join(', '))
	})
	it('is narrowed by the `accept` option on a "HEAD" as well', async () => {
		const [repo, seen] = record()
		await repo.manifests.exists('latest', { accept: [vnd.oci.image.indexV1] })
		expect(seen[0]).to.eq(vnd.oci.image.indexV1)
	})
})

describe('ReferrersApiV2 fallback', () => {
	const Subject = `sha256:${'a'.repeat(64)}`
	const Tag = `sha256-${'a'.repeat(64)}`

	const descriptor = (artifactType: string) => ({
		mediaType: vnd.oci.image.manifestV1,
		digest: `sha256:${'b'.repeat(64)}`,
		size: 1,
		artifactType,
	})

	// Answers `404 Not Found` for the Referrers API like a registry that does
	// not implement it, and serves `tagged` by the referrers tag schema.
	const registry = (tagged?: object): Transport => ({
		fetch(resource) {
			const u = new URL(resource instanceof Request ? resource.url : resource)
			if (u.pathname.includes('/referrers/')) {
				return Promise.resolve(new Response(null, { status: 404 }))
			}
			if (u.pathname.endsWith(`/manifests/${Tag}`) && tagged !== undefined) {
				return Promise.resolve(Response.json(tagged))
			}

			return Promise.resolve(new Response(null, { status: 404 }))
		},
	})

	const referrers = (transport: Transport) => new ClientV2('x.com', { transport }).repo('foo').referrers

	it('lists the referrers by the tag schema', async () => {
		const v = await referrers(
			registry({
				schemaVersion: 2,
				mediaType: vnd.oci.image.indexV1,
				manifests: [descriptor('application/foo'), descriptor('application/bar')],
			}),
		)
			.get(Subject)
			.unwrap()

		expect(v.manifests).to.have.lengthOf(2)
	})
	it('filters by the artifact type', async () => {
		const v = await referrers(
			registry({
				schemaVersion: 2,
				mediaType: vnd.oci.image.indexV1,
				manifests: [descriptor('application/foo'), descriptor('application/bar')],
			}),
		)
			.get(Subject, { artifactType: 'application/foo' })
			.unwrap()

		expect(v.manifests).to.have.lengthOf(1)
		expect(v.manifests[0].artifactType).to.eq('application/foo')
	})
	it('reports an empty list if the tag is not maintained', async () => {
		const v = await referrers(registry()).get(Subject).unwrap()
		expect(v.manifests).to.have.lengthOf(0)
	})
})

describe('BlobsV2Upload', () => {
	const Location = 'https://x.com/v2/foo/blobs/uploads/1'

	// Records the length of every chunk it is given.
	class Registry implements Transport {
		chunks: number[] = []

		constructor(private chunkMinLength?: number) {}

		async fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response> {
			const req = new Request(resource instanceof URL ? resource.toString() : resource, init)
			switch (req.method) {
				case 'POST': {
					const headers = new Headers({ Location })
					if (this.chunkMinLength !== undefined) {
						headers.set('OCI-Chunk-Min-Length', this.chunkMinLength.toString())
					}
					return new Response(null, { status: 202, headers })
				}
				case 'PATCH': {
					this.chunks.push((await req.arrayBuffer()).byteLength)
					return new Response(null, { status: 202, headers: { Location } })
				}
				default:
					return new Response(null, { status: 201, headers: { Location } })
			}
		}
	}

	const hasher = (): Hasher => ({ name: 'sha256', update: () => {}, digest: () => 'a'.repeat(64) })

	const upload = async (registry: Registry, data: Uint8Array<ArrayBuffer>) => {
		const client = new ClientV2('x.com', { transport: registry })
		const v = client.repo('foo').blobs.startUpload(hasher())
		await v.write(data)
		await v.close()
	}

	it('does not split the data below "OCI-Chunk-Min-Length"', async () => {
		const registry = new Registry(1024)
		await upload(registry, new Uint8Array(3000))
		expect(registry.chunks).to.eql([3000])
	})
	it('uploads in a single chunk if the registry does not ask for a minimum', async () => {
		const registry = new Registry()
		await upload(registry, new Uint8Array(3000))
		expect(registry.chunks).to.eql([3000])
	})
})
