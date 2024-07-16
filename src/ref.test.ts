import { Digest } from './digest'
import { Ref, type Reference } from './ref'

describe('Ref', () => {
	describe('parse', () => {
		describe('ok', () => {
			test.each<{
				given: string
				domain?: string
				name: string
				reference?: Reference
			}>([
				{
					given: 'a',
					name: 'a',
				},
				{
					given: 'a/b',
					name: 'a/b',
				},
				{
					given: 'a/b/c',
					name: 'a/b/c',
				},
				{
					given: 'x.com/a/b/c',
					domain: 'x.com',
					name: 'a/b/c',
				},
				{
					given: 'x.com:80/a/b/c',
					domain: 'x.com:80',
					name: 'a/b/c',
				},
				{
					given: 'a/b/c:latest',
					name: 'a/b/c',
					reference: 'latest',
				},
				{
					given: 'a/x.com:80',
					name: 'a/x.com',
					reference: '80',
				},
				{
					given: 'a/b/c@d:e',
					name: 'a/b/c',
					reference: new Digest('d', 'e'),
				},
				{
					given: 'a/b/c@d+d:e',
					name: 'a/b/c',
					reference: new Digest('d+d', 'e'),
				},
				{
					given: 'x.com/a/b/c:latest',
					domain: 'x.com',
					name: 'a/b/c',
					reference: 'latest',
				},
				{
					given: 'x.com/a/b/c@d+d:e',
					domain: 'x.com',
					name: 'a/b/c',
					reference: new Digest('d+d', 'e'),
				},
			])('$given', ({ given, domain, name, reference }) => {
				const actual = Ref.parse(given)
				expect(actual.domain).toEqual(domain)
				expect(actual.name).toEqual(name)
				expect(actual.reference).toEqual(reference)
			})
		})
		describe('component of name cannot be empty', () => {
			test.fails.each([
				{ given: '' },
				{ given: '/' },
				{ given: '//' },
				{ given: 'a/' },
				{ given: 'a//b' },
				{ given: 'x.com/' },
				{ given: ':latest' },
				{ given: 'a/:latest' },
				{ given: '@d:e' },
				{ given: 'a/@d:e' },
			])('$given', ({ given }) => {
				Ref.parse(given)
			})
		})
	})
})
