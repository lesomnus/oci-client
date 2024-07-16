import { ClientV2 } from './client'
import { oci } from './media-types'
import { Ref } from './ref'

// TODO: test against mock registry?
describe.skip('api v2', () => {
	const Domain = 'index.docker.io'

	test.concurrent('end-1', async () => {
		const client = new ClientV2(Domain)

		const req = client.ping()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
	})
	test.concurrent('end-3 GET', async () => {
		const client = new ClientV2(Domain)

		const req = client.repo(new Ref('library/node')).manifests.get('latest')
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)

		const v = res.unwrap().as(oci.image.indexV1)
		expect(v).not.to.be.undefined
		expect(v?.mediaType).to.eq(oci.image.indexV1)
	})
	test.concurrent('end-3 HEAD', async () => {
		const client = new ClientV2(Domain)

		const req = client.repo(new Ref('library/node')).manifests.exists('latest')
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(res.ok).to.be.true
	})
	test.concurrent('end-8a', async () => {
		const client = new ClientV2(Domain)

		const req = client.repo(new Ref('rancher/cowsay')).tags.list()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(res).has.property('name')
		expect(res).has.property('tags')

		const v = res.unwrap()
		expect(v.name).to.eq('rancher/cowsay')
		expect(v.tags).to.be.instanceOf(Array)
	})
	test.concurrent('end-8b', async () => {
		const client = new ClientV2(Domain)

		const req = client.repo(new Ref('library/node')).tags.list({
			n: 3,
			last: '20.15-bookworm',
		})
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(() => res.unwrap()).to.not.throw()

		const v = res.unwrap()
		expect(v.name).to.eq('library/node')
		expect(v.tags).to.be.instanceOf(Array)
		expect(v.tags).to.eql([
			// I got this values with actual request but I'm not sure it is constant.
			'20.15-bookworm-slim',
			'20.15-bullseye',
			'20.15-bullseye-slim',
		])
	})
})
