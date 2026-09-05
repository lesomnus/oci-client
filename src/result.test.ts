import { ResError } from './error'
import { type ErrorResponse, result } from './result'

const jsonError = (errors: ErrorResponse['errors'], status = 400) =>
	Promise.resolve(new Response(JSON.stringify({ errors } as ErrorResponse), { status, headers: { 'Content-Type': 'application/json' } }))

describe('result', () => {
	const empty = () => Promise.resolve({})

	describe('what the registry answered', () => {
		it('is a result where the response says so', async () => {
			const res = await result(Promise.resolve(new Response(null, { status: 200 })), () => Promise.resolve({ n: 42 })).result()

			expect(res.raw.status).to.eq(200)
			expect(res.ok).to.be.true
			if (!res.ok) expect.unreachable()
			expect(res.value).to.eql({ n: 42 })
			expect(res.errors).to.be.undefined
		})
		it('is an error where the response says so', async () => {
			const res = await result(jsonError([{ code: '42', message: 'nope', detail: '' }]), empty).result()

			expect(res.raw.status).to.eq(400)
			expect(res.ok).to.be.false
			if (res.ok) expect.unreachable()
			expect(res.value).to.be.undefined
			expect(res.errors.map(e => e.code)).to.eql(['42'])
		})
		it('is read once however many times it is asked for', async () => {
			// The body of a response can only be read once, which used to make
			// a second `unwrap` fail with "Body is unusable".
			const req = result(Promise.resolve(Response.json({ n: 42 })), r => r.json())

			expect(await req.unwrap()).to.eql({ n: 42 })
			expect(await req.unwrap()).to.eql({ n: 42 })
			expect((await req.result()).raw.status).to.eq(200)
		})
	})

	describe('unwrap', () => {
		it('answers the value where the response is a result', async () => {
			const v = await result(Promise.resolve(new Response(null, { status: 200 })), () => Promise.resolve({ n: 42 })).unwrap()
			expect(v).to.eql({ n: 42 })
		})
		it('throws `ResError` where the response is an error', async () => {
			await expect(result(jsonError([]), empty).unwrap()).rejects.toThrowError(ResError)
		})
		it('invokes the given callback before it throws', async () => {
			let seen: unknown
			const req = result(jsonError([{ code: '42', message: 'nope', detail: '' }]), empty)

			await expect(
				req.unwrap((_, errors) => {
					seen = errors
				}),
			).rejects.toThrowError(ResError)
			expect(seen).to.have.lengthOf(1)
		})
		it('rejects the error raised while resolving a result', async () => {
			const req = result(Promise.resolve(new Response(null, { status: 200 })), () => Promise.reject(new Error('cannot resolve')))
			await expect(req.unwrap()).rejects.toThrowError('cannot resolve')
		})
		it('rejects `ResError` where the registry failed', async () => {
			const req = result(Promise.resolve(new Response(null, { status: 500 })), empty)
			await expect(req.result()).rejects.toThrowError(ResError)
		})
		it('reports no entry where the body is not a well-formed error', async () => {
			const req = result(
				Promise.resolve(new Response('*not a json*', { status: 400, headers: { 'Content-Type': 'application/json' } })),
				empty,
			)

			const res = await req.result()
			expect(res.ok).to.be.false
			if (res.ok) expect.unreachable()
			expect(res.errors).to.be.empty
		})
	})

	describe('unwrapOr', () => {
		it('answers the value where the response is a result', async () => {
			const v = await result(Promise.resolve(new Response(null, { status: 200 })), () => Promise.resolve({ n: 42 })).unwrapOr(
				() => 'fallback',
			)
			expect(v).to.eql({ n: 42 })
		})
		it('answers what the callback returns where the response is an error', async () => {
			const v = await result(jsonError([{ code: '42', message: 'nope', detail: '' }]), empty).unwrapOr((_, errors) =>
				errors.map(e => e.code),
			)
			expect(v).to.eql(['42'])
		})
	})
})
