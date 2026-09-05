import type { ClientExtension } from './client'
import { ClientV2 } from './client-v2'
import type { Transport } from './transport'

const transport: Transport = {
	fetch: () => Promise.resolve(new Response(null, { status: 200 })),
}

function Foo(Base: ClientExtension) {
	return class Foo extends Base {
		foo() {
			return `foo:${this.domain}`
		}
	}
}

function Bar(Base: ClientExtension) {
	return class Bar extends Base {
		bar() {
			return 'bar'
		}
	}
}

describe('ClientV2', () => {
	it('rejects an invalid domain', () => {
		expect(() => new ClientV2('x .com')).to.throw()
	})
	it('fills the domain of the reference', () => {
		const client = new ClientV2('x.com', { transport })
		expect(client.repo('foo/bar').ref.domain).to.eq('x.com')
	})
	it('keeps the domain of the reference if it is given', () => {
		const client = new ClientV2('x.com', { transport })
		expect(client.repo('y.com/foo/bar').ref.domain).to.eq('y.com')
	})

	describe('make', () => {
		it('creates a client', () => {
			const client = ClientV2.make('x.com', { transport })
			expect(client).to.be.instanceOf(ClientV2)
			expect(client.domain).to.eq('x.com')
		})
		it('creates a composed client without wrapping it in parentheses', () => {
			const client = ClientV2.with(Foo, Bar).make('x.com', { transport })

			expect(client.foo()).to.eq('foo:x.com')
			expect(client.bar()).to.eq('bar')
			expect(client.repo('foo/bar').ref.domain).to.eq('x.com')
		})
		it('creates the same thing as `new` does', () => {
			const Client = ClientV2.with(Foo)
			const made = Client.make('x.com', { transport })
			const constructed = new Client('x.com', { transport })

			expect(made.foo()).to.eq(constructed.foo())
			expect(made).to.be.instanceOf(Client)
			expect(constructed).to.be.instanceOf(Client)
		})
		it('rejects an invalid domain like the constructor does', () => {
			expect(() => ClientV2.with(Foo).make('x .com')).to.throw()
		})
	})

	describe('with', () => {
		it('composes multiple extensions', () => {
			const Client = ClientV2.with(Foo, Bar)
			const client = new Client('x.com', { transport })

			expect(client.foo()).to.eq('foo:x.com')
			expect(client.bar()).to.eq('bar')
		})
		it('keeps the features of the client', async () => {
			const Client = ClientV2.with(Foo)
			const client = new Client('x.com', { transport })

			expect(client.repo('foo/bar').ref.name).to.eq('foo/bar')
			await expect(client.ping().unwrap()).resolves.toBeTruthy()
		})
	})
})
