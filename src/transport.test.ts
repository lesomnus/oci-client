import { Accept, PathPrefix, type ReqInit, type Transport, TransportChain, type TransportMiddleware, Unsecure } from './transport'

class Terminal implements Transport {
	cnt = 0
	get touched() {
		return this.cnt > 0
	}

	constructor(private cb?: (resource: RequestInfo | URL, init?: ReqInit) => void) {}

	fetch(resource: RequestInfo | URL, init?: ReqInit): Promise<Response> {
		this.cnt++
		this.cb?.(resource, init)
		return Promise.resolve(new Response(null))
	}
}

describe('TransportChain', () => {
	it('executes middlewares sequentially if the one of the middlewares is not failed', async () => {
		let n = 0
		const numbers: number[] = []

		const mw: TransportMiddleware = {
			fetch(resource, init, next) {
				numbers.push(n++)
				return next.fetch(resource, init)
			},
		}

		const terminal = new Terminal()
		const transport = new TransportChain([mw, mw, mw, terminal])

		const req = transport.fetch('')
		await expect(req).resolves.ok

		const res = await req
		expect(res.body).to.eq(null)
		expect(n).to.eq(3)
		expect(numbers).to.eql([0, 1, 2])
		expect(terminal.touched).to.be.true
	})
	test('next should reusable', async () => {
		let n = 0
		const numbers: number[] = []

		const mw: TransportMiddleware = {
			fetch(resource, init, next) {
				numbers.push(n++)
				return next.fetch(resource, init)
			},
		}

		const terminal = new Terminal()
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
			terminal,
		])

		const req = transport.fetch('')
		await expect(req).resolves.ok

		const res = await req
		expect(res.body).to.eq(null)
		expect(n).to.eq(3)
		expect(numbers).to.eql([0, 42, 1, 36, 2])
		expect(terminal.cnt).to.be.eq(2)
	})
})

describe('Unsecure', () => {
	it('changes "https" to "http"', async () => {
		const terminal = new Terminal(resource => {
			expect(resource.toString()).to.eq('http://x.com/')
		})
		const transport = new TransportChain([new Unsecure(), terminal])

		await transport.fetch('https://x.com')
		expect(terminal.touched).to.be.true
	})
})

describe('PathPrefix', () => {
	it('add a prefix to the URL path', async () => {
		const terminal = new Terminal(resource => {
			expect(resource.toString()).to.eq('https://x.com/foo/bar')
		})
		const transport = new TransportChain([new PathPrefix('foo'), terminal])

		await transport.fetch('https://x.com/bar')
		expect(terminal.touched).to.be.true
	})
	it('does not duplicate a prefix', async () => {
		const terminal = new Terminal(resource => {
			expect(resource.toString()).to.eq('https://x.com/foo/bar')
		})
		const transport = new TransportChain([new PathPrefix('foo'), new PathPrefix('foo'), terminal])

		await transport.fetch('https://x.com/bar')
		expect(terminal.touched).to.be.true
	})
})

describe('Accept', () => {
	it('add an "Accept" header', async () => {
		const terminal = new Terminal((resource, init) => {
			const req = new Request(resource, init)
			const accept = req.headers.get('Accept')
			expect(accept).to.contain('foo')
		})
		const transport = new TransportChain([
			new Accept({
				manifests: ['foo'],
			}),
			terminal,
		])

		await transport.fetch('https://x.com', {
			endpoint: {
				method: 'GET',
				name: '',
				resource: 'manifests',
				reference: '',
			},
		})
	})
	it('does not add an "Accept" header to the request to another resource', async () => {
		const terminal = new Terminal((resource, init) => {
			const req = new Request(resource, init)
			const accept = req.headers.get('Accept')
			expect(accept).to.be.null
		})
		const transport = new TransportChain([
			new Accept({
				manifests: ['foo'],
			}),
			terminal,
		])

		await transport.fetch('https://x.com')
		expect(terminal.cnt).to.eq(1)

		await transport.fetch('https://x.com', {
			endpoint: {
				method: 'GET',
				name: '',
				resource: 'tags',
				action: 'list',
			},
		})
		expect(terminal.cnt).to.eq(2)
	})
})
