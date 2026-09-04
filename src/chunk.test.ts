import { Chunk } from './chunk'

describe('Chunk', () => {
	describe('constructor', () => {
		it('takes the length from a `BufferSource`', () => {
			const v = new Chunk(Uint8Array.from([1, 2, 3]))
			expect(v.length).to.eq(3)
			expect(v.pos).to.eq(0)
		})
		it('takes the length from a `Blob`', () => {
			const v = new Chunk(new Blob(['foo']))
			expect(v.length).to.eq(3)
		})
		it('takes the position', () => {
			const v = new Chunk(Uint8Array.from([1, 2, 3]), 42)
			expect(v.length).to.eq(3)
			expect(v.pos).to.eq(42)
		})
		it('takes the length of a `ReadableStream` explicitly', () => {
			const v = new Chunk(new Blob(['foo']).stream(), 3, 42)
			expect(v.length).to.eq(3)
			expect(v.pos).to.eq(42)
		})
		it('fails if the length of a `ReadableStream` is not given', () => {
			// @ts-expect-error the length is required by the signature.
			expect(() => new Chunk(new Blob(['foo']).stream())).to.throw()
		})
	})
	describe('range', () => {
		test.each([
			{ data: Uint8Array.from([1, 2, 3]), pos: 0, expected: '0-2' },
			{ data: Uint8Array.from([1, 2, 3]), pos: 3, expected: '3-5' },
			{ data: Uint8Array.from([1]), pos: 7, expected: '7-7' },
		])('$pos -> $expected', ({ data, pos, expected }) => {
			expect(new Chunk(data, pos).range.toString()).to.eq(expected)
		})
	})
	describe('withPos', () => {
		it('keeps the data and the length', () => {
			const data = Uint8Array.from([1, 2, 3])
			const v = new Chunk(data, 0).withPos(9)
			expect(v.data).to.eq(data)
			expect(v.length).to.eq(3)
			expect(v.pos).to.eq(9)
		})
		it('keeps the length of a `ReadableStream`', () => {
			const v = new Chunk(new Blob(['foo']).stream(), 3).withPos(9)
			expect(v.length).to.eq(3)
			expect(v.pos).to.eq(9)
		})
	})
})
