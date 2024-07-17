import { ClientV2 } from './client'
import { oci } from './media-types'
import { Ref } from './ref'
import { Accept, FetchTransport, Unsecure } from './transport'

describe('api v2', () => {
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

	test.concurrent('end-1', async () => {
		const req = client.ping()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
	})
	test.concurrent('end-3 GET', async () => {
		const req = client.repo(new Ref('library/busybox')).manifests.get('1.36-musl')
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)

		const v = res.unwrap().as(oci.image.indexV1)
		expect(v).not.to.be.undefined
		expect(v?.mediaType).to.eq(oci.image.indexV1)
	})
	test.concurrent('end-3 HEAD', async () => {
		const req = client.repo(new Ref('library/busybox')).manifests.exists('1.36-musl')
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(res.ok).to.be.true
	})
	test.concurrent('end-8a', async () => {
		const req = client.repo(new Ref('library/busybox')).tags.list()
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(res).has.property('name')
		expect(res).has.property('tags')

		// TODO: tags must be in lexical order but `registry` does not comply it.
		const v = res.unwrap()
		expect(v.name).to.eq('library/busybox')
		expect(v.tags).to.eql(['1.36-musl', '1.35-musl', '1.34-musl'])
	})
	test.concurrent('end-8b', async () => {
		const req = client.repo(new Ref('library/busybox')).tags.list({
			n: 2,
			last: '1.35-musl',
		})
		await expect(req).resolves.ok

		const res = await req
		expect(res.raw.status).to.eq(200)
		expect(() => res.unwrap()).to.not.throw()

		const v = res.unwrap()
		expect(v.name).to.eq('library/busybox')
		expect(v.tags).to.be.instanceOf(Array)
		expect(v.tags).to.eql(['1.34-musl'])
	})
})
