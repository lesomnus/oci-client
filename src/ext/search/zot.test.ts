import { ClientV2, FetchTransport, Unsecure } from '#src/index'
import { vnd } from '#src/media-types'
import T from '#src/testutils'
import { Zot } from './zot'

const Client = ClientV2.with(Zot)
const client = new Client(T.env.Domain, {
	transport: [new Unsecure(), new FetchTransport()],
})

// The search extension is optional and the registry advertises whether it is
// enabled, so the tests follow the registry rather than being declared.
const enabled = await (async () => {
	try {
		const res = await client.transport.fetch(`https://${T.env.Domain}/v2/_oci/ext/discover`)
		if (res.status !== 200) {
			return false
		}

		const v = await res.json()
		return JSON.stringify(v.extensions ?? []).includes('/v2/_zot/ext/search')
	} catch {
		return false
	}
})()

describe.skipIf(!enabled)('ext search zot', () => {
	const Prefix = 'search-zot'
	const Repos = [`${Prefix}/a`, `${Prefix}/b`, `${Prefix}/c`]

	// The body of a suite is collected even where the suite is skipped, so
	// pushing here keeps it off the registries the suite is skipped for.
	beforeAll(async () => {
		for (const name of Repos) {
			const image = T.asset.Images['v0.1.0']
			const repo = client.repo(name)
			await repo.blobs.upload(vnd.oci.empty.digest, T.asset.EmptyObjectData).unwrap()
			await repo.blobs.upload(image.digest, image.chunk).unwrap()
			await repo.manifests.put(image.ref, vnd.oci.image.manifestV1, image.manifestBytes).unwrap()
		}
	})

	// The registry indexes what was pushed on its own schedule.
	const found = async (query: string) => {
		const v = await client.search(query).unwrap()
		return v.repositories.map(r => r.name).filter(n => n.startsWith(Prefix))
	}

	test('finds the repositories', async () => {
		await expect.poll(() => found(Prefix), { timeout: 10_000 }).toEqual(Repos)
	})
	test('reports what the registry counts', async () => {
		await expect.poll(() => found(Prefix), { timeout: 10_000 }).toHaveLength(Repos.length)

		const v = await client.search(Prefix).unwrap()
		expect(v.total).to.be.a('number')

		const [repo] = v.repositories
		expect(repo.downloads).to.be.a('number')
		expect(repo.stars).to.be.a('number')
		expect(repo.lastUpdated).to.be.instanceOf(Date)
	})
	test('paginates', async () => {
		await expect.poll(() => found(Prefix), { timeout: 10_000 }).toHaveLength(Repos.length)

		const first = await client.search(Prefix, { n: 1 }).unwrap()
		expect(first.repositories).to.have.lengthOf(1)

		const second = await client.search(Prefix, { n: 1, page: 2 }).unwrap()
		expect(second.repositories).to.have.lengthOf(1)
		expect(second.repositories[0].name).not.to.eq(first.repositories[0].name)
	})
	test('rejects a page before the first', () => {
		expect(() => client.search(Prefix, { page: 0 })).to.throw()
	})

	describe('graphql', () => {
		test('queries what the search does not cover', async () => {
			const v = await client
				.graphql<{ ImageList: { Results: { Tag: string }[] } }>(
					'query($repo: String!) { ImageList(repo: $repo) { Results { Tag } } }',
					{
						repo: Repos[0],
					},
				)
				.unwrap()

			expect(v.ImageList.Results.map(i => i.Tag)).to.eql(['v0.1.0'])
		})
		test('reports the reason of a query that does not parse', async () => {
			await expect(client.graphql('{ NoSuchField }').unwrap()).rejects.toThrowError(/NoSuchField/)
		})
	})
})
