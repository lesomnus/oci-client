import type { ReqInit, Transport } from '~/index'
import { ClientV2 } from '~/index'
import { V1 } from './v1'

// Answers like Docker Hub does.
class Hub implements Transport {
	requests: URL[] = []

	fetch(resource: RequestInfo | URL, _init?: ReqInit): Promise<Response> {
		const u = new URL(resource instanceof Request ? resource.url : resource)
		this.requests.push(u)

		return Promise.resolve(
			Response.json({
				num_pages: 97383,
				num_results: 292148,
				page_size: 2,
				page: 1,
				query: u.searchParams.get('q'),
				results: [
					{
						name: 'nginx',
						description: 'Official build of Nginx.',
						pull_count: 13328112634,
						star_count: 21369,
						is_trusted: false,
						is_automated: false,
						is_official: true,
					},
					{
						name: 'nginx/nginx-ingress',
						description: '',
						pull_count: 1087037639,
						star_count: 122,
						is_trusted: false,
						is_automated: false,
						is_official: false,
					},
				],
			}),
		)
	}
}

describe('ext search v1', () => {
	const Client = ClientV2.with(V1)
	const make = () => {
		const hub = new Hub()
		return [new Client('index.docker.io', { transport: hub }), hub] as const
	}

	it('reports what the registry holds', async () => {
		const [client] = make()
		const v = await client.search('nginx').unwrap()

		expect(v.total).to.eq(292148)
		expect(v.repositories).to.have.lengthOf(2)
		expect(v.repositories[0]).to.eql({
			name: 'nginx',
			description: 'Official build of Nginx.',
			stars: 21369,
			downloads: 13328112634,
			official: true,
		})
	})
	it('does not report an empty description', async () => {
		const [client] = make()
		const v = await client.search('nginx').unwrap()
		expect(v.repositories[1].description).to.be.undefined
	})
	it('asks the endpoint of the registry', async () => {
		const [client, hub] = make()
		await client.search('nginx', { n: 2, page: 3 }).unwrap()

		const [u] = hub.requests
		expect(u.host).to.eq('index.docker.io')
		expect(u.pathname).to.eq('/v1/search')
		expect(u.searchParams.get('q')).to.eq('nginx')
		expect(u.searchParams.get('n')).to.eq('2')
		expect(u.searchParams.get('page')).to.eq('3')
	})
	it('omits the page if it is the first', async () => {
		const [client, hub] = make()
		await client.search('nginx').unwrap()
		expect(hub.requests[0].searchParams.has('page')).to.be.false
	})
	it('rejects a page before the first', () => {
		const [client] = make()
		expect(() => client.search('nginx', { page: 0 })).to.throw()
	})
})
