import { ClientV2, FetchTransport, Unsecure } from '~/index'
import { vnd } from '~/media-types'
import T from '~/testutils'
import { Catalog } from './catalog'

describe.concurrent('ext catalog', async () => {
	const Client = ClientV2.with(Catalog)
	const client = new Client(T.env.Domain, {
		transport: [new Unsecure(), new FetchTransport()],
	})

	const init = async (ref: string) => {
		const image = T.asset.Images['v0.1.0']
		const repo = client.repo(ref)
		await repo.blobs.upload(vnd.oci.empty.digest, T.asset.EmptyObjectData).unwrap()
		await repo.blobs.upload(image.digest, image.chunk).unwrap()
		await repo.manifests.put(image.ref, vnd.oci.image.manifestV1, JSON.stringify(image.manifest)).unwrap()
	}

	const Repos = ['catalog/a', 'catalog/b', 'catalog/c'].sort()
	for (const repo of Repos) {
		await init(repo)
	}

	test('get', async () => {
		const res = await client.catalog().unwrap()
		const repos = res.repositories.filter(v => v.startsWith('catalog/'))
		expect(repos.sort()).to.eql(Repos)
	})
	test('paginate', async () => {
		const first = await client.catalog({ n: 1 }).unwrap()
		expect(first.repositories).to.have.lengthOf(1)

		const next = await client.catalog({ n: 1, last: first.repositories[0] }).unwrap()
		expect(next.repositories).to.have.lengthOf(1)
		expect(next.repositories[0]).not.to.eq(first.repositories[0])
	})
	test('rejects a negative "n"', () => {
		expect(() => client.catalog({ n: -1 })).to.throw()
	})
})
