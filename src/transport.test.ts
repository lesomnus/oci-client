import { TransportChain, type TransportMiddleware } from './transport'

describe('TransportChain', () => {
	it('executes middlewares sequentially if the one of the middlewares is not failed', async () => {
		let n = 0
		const numbers: number[] = []
		let done = false

		const mw: TransportMiddleware = {
			fetch(resource, init, next) {
				numbers.push(n++)
				return next.fetch(resource, init)
			},
		}
		const transport = new TransportChain([
			mw,
			mw,
			mw,
			{
				fetch() {
					done = true
					return Promise.resolve(new Response(null))
				},
			},
		])

		const req = transport.fetch('')
		await expect(req).resolves.ok

		const res = await req
		expect(res.body).to.eq(null)
		expect(n).to.eq(3)
		expect(numbers).to.eql([0, 1, 2])
		expect(done).to.be.true
	})
	test('next should reusable', async () => {
		let n = 0
		const numbers: number[] = []
		let done = false

		const mw: TransportMiddleware = {
			fetch(resource, init, next) {
				numbers.push(n++)
				return next.fetch(resource, init)
			},
		}
		const transport = new TransportChain([
			mw,
			{
				async fetch(resource, init, next) {
					numbers.push(42)
					await next.fetch(resource, init)
					numbers.push(36)
					return next.fetch(resource, init)
				},
			},
			mw,
			{
				fetch(resource, init) {
					done = true
					return Promise.resolve(new Response(null))
				},
			},
		])

		const req = transport.fetch('')
		await expect(req).resolves.ok

		const res = await req
		expect(res.body).to.eq(null)
		expect(n).to.eq(3)
		expect(numbers).to.eql([0, 42, 1, 36, 2])
		expect(done).to.be.true
	})
})
