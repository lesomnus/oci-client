import { Digest, HashAlgorithm } from './digest'

describe('HashAlgorithm', () => {
	describe('parse', () => {
		describe('ok', () => {
			test.each([
				{ given: '0', expected: ['0'] },
				{ given: 'a', expected: ['a'] },
				{ given: 'a+b', expected: ['a', 'b'] },
				{ given: 'a+0', expected: ['a', '0'] },
				{ given: 'a+b.c_d-e', expected: ['a', 'b', 'c', 'd', 'e'] },
			])('$given', ({ given, expected }) => {
				const actual = HashAlgorithm.parse(given)
				expect(actual).toEqual(expected)
			})
		})
		describe('component cannot be empty', () => {
			test.fails.each([
				{ given: '' }, //
				{ given: 'a+' },
				{ given: 'a++b' },
				{ given: 'a+-+b' },
			])('$given', ({ given }) => {
				HashAlgorithm.parse(given)
			})
		})
		describe('invalid letters for the component', () => {
			test.fails.each([
				{ given: 'A' }, //
				{ given: 'a|b' },
				{ given: 'a b' },
			])('$given', ({ given }) => {
				HashAlgorithm.parse(given)
			})
		})
	})
	describe('toString', () => {
		test.each([
			{ given: 'a', expected: 'a' },
			{ given: 'a+b', expected: 'a+b' },
			{ given: 'a.b', expected: 'a+b' },
		])('$given -> $expected', ({ given, expected }) => {
			const v = HashAlgorithm.parse(given).toString()
			expect(v).toEqual(expected)
		})
	})
})

describe('Digest', () => {
	describe('parse', () => {
		describe('ok', () => {
			test.each<{
				given: string
				expected: [string, string]
			}>([
				{ given: 'a:b', expected: ['a', 'b'] }, //
				{ given: 'a+a:b', expected: ['a+a', 'b'] },
			])('$given', ({ given, expected: [algorithm, encoded] }) => {
				const v = Digest.parse(given)
				expect(v.algorithm.toString()).toEqual(algorithm)
				expect(v.encoded).toEqual(encoded)
			})
		})
		describe('sha256', () => {
			test('valid', () => {
				Digest.parse(`sha256:${'a'.repeat(64)}`)
			})
			test.fails('length must 64', () => {
				Digest.parse(`sha256:${'a'.repeat(63)}`)
			})
			test.fails('only lowercases are allowed', () => {
				Digest.parse(`sha256:${'A'.repeat(64)}`)
			})
		})
		describe('sha512', () => {
			test('valid', () => {
				Digest.parse(`sha512:${'a'.repeat(128)}`)
			})
			test.fails('length must 64', () => {
				Digest.parse(`sha512:${'a'.repeat(127)}`)
			})
			test.fails('only lowercases are allowed', () => {
				Digest.parse(`sha512:${'A'.repeat(128)}`)
			})
		})
		describe('encoded part cannot be empty', () => {
			test.fails.each([
				{ given: 'a' }, //
				{ given: 'a:' },
			])('$given', ({ given }) => {
				Digest.parse(given)
			})
		})
		describe('invalid letters for the encoded part', () => {
			test.fails.each([
				{ given: 'a::' }, //
				{ given: 'a:@' },
				{ given: 'a:+' },
			])('$given', ({ given }) => {
				Digest.parse(given)
			})
		})
	})
})
