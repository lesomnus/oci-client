import { Catalog } from './catalog'

import { ClientV2 } from '../client-v2'
import { oci } from '../media-types'
import * as T from '../testutils'
import { FetchTransport, Unsecure } from '../transport'

describe.concurrent('ext catalog', async () => {
	const Client = ClientV2.with(Catalog())
	const client = new Client(T.env.Domain, {
		transport: [new Unsecure(), new FetchTransport()],
	})

	const init = async (ref: string) => {
		const image = T.asset.Images['v0.1.0']
		const repo = client.repo(ref)
		await repo.blobs.upload(oci.empty.digest, T.asset.EmptyObjectData).unwrap()
		await repo.blobs.upload(image.digest, image.chunk).unwrap()
		await repo.manifests.put(image.ref, oci.image.manifestV1, JSON.stringify(image.manifest)).unwrap()
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
})
