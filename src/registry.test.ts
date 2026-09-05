import { ClientV2, FetchTransport, flavorOf, type ReqInit, type Transport, Unsecure } from '#src/index'
import T from '#src/testutils'

describe('detect', () => {
	const client = new ClientV2(T.env.Domain, {
		transport: [new Unsecure(), new FetchTransport()],
	})

	it('tells the implementation the registry is', async () => {
		const v = await client.detect().unwrap()

		// The registry under test is known so what is detected can be checked.
		expect(v.flavor).to.eq(T.env.Kind.startsWith('distribution') ? 'distribution' : 'zot')
	})
	it('reports the extensions the registry advertises', async () => {
		const v = await client.detect().unwrap()

		if (T.env.Kind.startsWith('distribution')) {
			// distribution does not implement the discovery at all.
			expect(v.extensions).to.be.empty
			return
		}

		// A zot built without the extensions advertises none of them, in which
		// case it is told apart by how it answers rather than by what it says.
		const zot = v.extensions.find(e => e.name === '_zot')
		if (zot === undefined) {
			expect(v.version).to.be.undefined
			return
		}

		expect(zot.endpoints).not.to.be.empty
		expect(v.version).to.match(/^v\d+\.\d+\.\d+/)
		expect(v.specVersion).to.match(/^\d+\.\d+\.\d+/)
	})
	it('tells what the registry can be asked for', async () => {
		const v = await client.detect().unwrap()

		// A zot built without its extensions serves no search although it is
		// still zot, so what is advertised decides rather than what it is.
		const advertised = v.extensions.some(e => e.endpoints.some(p => p.endsWith('/ext/search')))
		expect(v.features.search).to.eq(advertised ? 'zot' : undefined)

		// Every registry under test serves the catalog without asking for an
		// authorization.
		expect(v.features.catalog).to.be.true
	})
	it('lists nothing where the registry does not implement the discovery', async () => {
		const v = await client.discover().unwrap()
		expect(v.extensions).to.be.instanceOf(Array)
	})
})

describe('flavorOf', () => {
	const res = (headers: Record<string, string>) => new Response(null, { headers })

	it('tells zot by the header its own client sends', () => {
		expect(flavorOf(res({ 'Access-Control-Allow-Headers': 'Authorization,content-type,X-ZOT-API-CLIENT' }))).to.eq('zot')
	})
	it('tells distribution by what it sets', () => {
		expect(
			flavorOf(
				res({
					'X-Content-Type-Options': 'nosniff',
					'Docker-Distribution-Api-Version': 'registry/2.0',
				}),
			),
		).to.eq('distribution')
	})
	it('tells nothing where there is nothing to tell it apart', () => {
		// It is how Docker Hub answers, which serves distribution behind it.
		expect(flavorOf(res({ 'Docker-Distribution-Api-Version': 'registry/2.0' }))).to.be.undefined
		expect(flavorOf(res({}))).to.be.undefined
	})
})

describe('detect without a registry', () => {
	// Advertises `_zot` but serves no management endpoint.
	const advertising = (endpoints: string[]): Transport => ({
		fetch(resource: RequestInfo | URL, _init?: ReqInit) {
			const u = new URL(resource instanceof Request ? resource.url : resource)
			if (u.pathname === '/v2/_oci/ext/discover') {
				return Promise.resolve(Response.json({ extensions: [{ name: '_zot', url: 'https://example.com', endpoints }] }))
			}

			return Promise.resolve(new Response(null, { status: 200 }))
		},
	})

	it('reports zot without a version where the management is not served', async () => {
		const client = new ClientV2('x.com', { transport: advertising(['/v2/_zot/ext/search']) })
		const v = await client.detect().unwrap()

		expect(v.flavor).to.eq('zot')
		expect(v.version).to.be.undefined
	})
	it('tells the search dialect of a registry that serves "/v1/search"', async () => {
		// It is not owned by one implementation: Docker Hub and quay.io both
		// serve it while neither says what it is.
		const client = new ClientV2('x.com', {
			transport: {
				fetch(resource) {
					const u = new URL(resource instanceof Request ? resource.url : resource)
					if (u.pathname === '/v1/search') {
						return Promise.resolve(Response.json({ num_results: 0, results: [] }))
					}
					if (u.pathname === '/v2/_catalog') {
						return Promise.resolve(new Response(null, { status: 401 }))
					}

					return Promise.resolve(new Response(null, { status: 404 }))
				},
			},
		})

		const v = await client.detect().unwrap()
		expect(v.features.search).to.eq('v1')
		// It is served but it would not say what it holds.
		expect(v.features.catalog).to.be.undefined
		expect(v.flavor).to.be.undefined
	})
	it('tells that the catalog is not served', async () => {
		const client = new ClientV2('x.com', {
			transport: { fetch: () => Promise.resolve(new Response(null, { status: 404 })) },
		})

		const v = await client.detect().unwrap()
		expect(v.features.catalog).to.be.false
		expect(v.features.search).to.be.undefined
	})
	it('reports no extension where the discovery answers "404 Not Found"', async () => {
		const client = new ClientV2('x.com', {
			transport: { fetch: () => Promise.resolve(new Response(null, { status: 404 })) },
		})

		const v = await client.discover().unwrap()
		expect(v.extensions).to.be.empty
	})
})
