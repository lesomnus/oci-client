import { ResError } from './error'
import { type ErrorResponse, result } from './result'

describe('result', () => {
	const emptyValue = () => Promise.resolve({})

	it('resolves opaque result on successful response', async () => {
		const res = new Response(null, { status: 200 })
		const req = Promise.resolve(res)
		const rst = result(req, emptyValue)
		await expect(rst).resolves.ok
	})
	it('resolves opaque result on client error response', async () => {
		const res = new Response(null, { status: 400 })
		const req = Promise.resolve(res)
		const rst = result(req, emptyValue)
		await expect(rst).resolves.ok
	})
	it('rejects `ResError` on server error response', async () => {
		const res = new Response(null, { status: 500 })
		const req = Promise.resolve(res)
		const rst = result(req, emptyValue)
		await expect(rst).rejects.toThrowError(ResError)
	})

	describe('unwrap', async () => {
		it('resolves a value on successful response', async () => {
			const res = new Response(null, { status: 200 })
			const req = Promise.resolve(res)
			const rst = result(req, () => Promise.resolve({ n: 42 })).unwrap()
			await expect(rst).resolves.toHaveProperty('n', 42)
		})
		it('rejects `ResError` on client error response', async () => {
			const res = new Response(null, { status: 400 })
			const req = Promise.resolve(res)
			const rst = result(req, emptyValue).unwrap()
			await expect(rst).rejects.toThrowError(ResError)
		})
		it('invokes given callback on error', async () => {
			let touched = false

			const res = new Response(null, { status: 400 })
			const req = Promise.resolve(res)
			const rst = result(req, emptyValue).unwrap(() => {
				touched = true
			})
			await expect(rst).rejects.toThrowError(ResError)
			expect(touched).to.be.true
		})
		it('invokes given callback with errors if available', async () => {
			let touched = false

			const res = new Response(
				JSON.stringify({
					errors: [
						{
							code: '42',
							message: '',
							detail: '',
						},
					],
				} as ErrorResponse),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
					},
				},
			)
			const req = Promise.resolve(res)
			const rst = result(req, emptyValue).unwrap((_, errors) => {
				touched = true
				expect(errors).to.have.lengthOf(1)
				expect(errors[0].code).to.eq('42')
			})
			await expect(rst).rejects.toThrowError(ResError)
			expect(touched).to.be.true
		})
	})
})
