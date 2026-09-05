import { Chunk, ClientV2, FetchTransport, ResError, TransportAuthorizer, Unsecure } from '~/index'
import { vnd } from '~/media-types'
import T from '~/testutils'

const Repo = T.env.PrivateRepo

const repoOf = (credential?: { username: string; password: string }) =>
	new ClientV2(T.env.Domain, {
		transport:
			credential === undefined
				? [new Unsecure(), new FetchTransport()]
				: [new Unsecure(), new TransportAuthorizer({ credential }), new FetchTransport()],
	}).repo(Repo)

const anonymous = repoOf()
const authorized = repoOf(T.env.Credential)

// The registry has to be configured to protect the repository, which is what
// it answers rather than something to be declared.
const protectedRepo = (await anonymous.tags.list().result()).raw.status === 401

describe.skipIf(!protectedRepo)('a repository that requires an authorization', () => {
	const image = T.asset.Images['v0.1.0']

	// It is pushed here rather than in the body of the suite since the body is
	// collected even where the suite is skipped, which would push it to a
	// registry that the suite is skipped for.
	beforeAll(async () => {
		await authorized.blobs.upload(vnd.oci.empty.digest, T.asset.EmptyObjectData).unwrap()
		await authorized.blobs.upload(image.digest, image.chunk).unwrap()
		await authorized.manifests.put(image.ref, vnd.oci.image.manifestV1, image.manifestBytes).unwrap()
	})

	describe('without a credential', () => {
		test('is not listed', async () => {
			expect((await anonymous.tags.list().result()).raw.status).to.eq(401)
		})
		test('does not serve a manifest', async () => {
			expect((await anonymous.manifests.get(image.ref).result()).raw.status).to.eq(401)
		})
		test('does not say whether a manifest is there', async () => {
			// It is not the same as saying that it is not.
			await expect(anonymous.manifests.exists(image.ref)).rejects.toThrowError(ResError)
		})
		test('does not accept a blob', async () => {
			const res = await anonymous.blobs.upload(image.digest, image.chunk).result()
			expect(res.raw.status).to.eq(401)
		})
	})

	describe('with the credential', () => {
		test('is listed', async () => {
			const v = await authorized.tags.list().unwrap()
			expect(v.tags).to.contain(image.ref)
		})
		test('serves the manifest that was pushed', async () => {
			const v = await authorized.manifests.get(image.ref).unwrap()
			expect(v.as(vnd.oci.image.manifestV1)?.layers[0].digest).to.eq(image.digest.toString())
		})
		test('serves a blob', async () => {
			const res = await authorized.blobs.get(image.digest).result()
			expect(res.raw.status).to.eq(200)
			await expect(res.raw.text()).resolves.toBe(image.data)
		})
		test('accepts a blob in chunks', async () => {
			const data = T.encodeString(`chunked ${Date.now()}\n`)
			const digest = await T.hash(data)

			const { location } = await authorized.blobs.initUpload().unwrap()
			const { location: next } = await authorized.blobs.uploadChunk(location, new Chunk(data)).unwrap()

			expect((await authorized.blobs.closeUpload(next, digest).result()).raw.status).to.eq(201)
			expect((await authorized.blobs.exists(digest)).ok).to.be.true
		})
	})

	test('refuses a credential that is not the one it wants', async () => {
		const wrong = repoOf({ username: T.env.Credential.username, password: 'not-the-password' })
		expect((await wrong.tags.list().result()).raw.status).to.eq(401)
	})
})
