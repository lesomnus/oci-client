import { Digest } from './digest'

const Patterns = {
	Domain: /^[^:/$\s]{1,}(:\d{1,})?$/,
	Name: /^[a-z0-9]+((\.|_|__|-+)[a-z0-9]+)*(\/[a-z0-9]+((\.|_|__|-+)[a-z0-9]+)*)*$/,
	Tag: /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/,
}

function splitN(s: string, sep: string, n: number): string[] {
	if (n === 0) {
		return []
	}

	const v = s.split(sep)
	if (v.length > n) {
		v[n - 1] = v.slice(n - 1).join(sep)
		v.length = n
	}

	return v
}

export type Reference = string | Digest

// Ref holds both namespace of the repository and reference of the image.
// Optionally it also holds hostname and port of the registry service.
export class Ref {
	// Parse `Ref` from a string formed as:
	// ```
	// [{hostname}[:{port}]/]{name}[:{tag}|@{digest}]
	// ```
	// The first component of the name is treated as domain if it contains '.' or ':' character.
	// e.g.          domain name
	//               ------ ---------
	//  x.com/a/b -> x.com  a/b
	//  a/x.com/b ->        a/x.com/b
	static parse(text: string) {
		const vs = text.split('/')
		if (vs.length === 0 || vs.some(v => v === '')) {
			throw new SyntaxError('empty string')
		}

		let domain: undefined | string
		let name: string
		let reference: undefined | Reference

		const last = vs[vs.length - 1]
		// Digest must be checked before tag since digest contains ':'.
		if (last.indexOf('@') > 0) {
			let maybe_digest: string
			;[vs[vs.length - 1], maybe_digest] = splitN(last, '@', 2)

			reference = Digest.parse(maybe_digest)
		} else if (last.indexOf(':') > 0) {
			;[vs[vs.length - 1], reference] = splitN(last, ':', 2)
		}

		if (vs.length === 1) {
			name = vs[0]
		} else if ((vs[0].includes('.') || vs[0].includes(':')) && Patterns.Domain.test(vs[0])) {
			domain = vs[0]
			name = vs.slice(1).join('/')
		} else {
			name = vs.join('/')
		}

		return new Ref(name, { domain, reference })
	}

	readonly domain?: string
	readonly reference?: Reference

	constructor(
		readonly name: string,
		extra?: { domain?: string; reference?: Reference },
	) {
		if (!Patterns.Name.test(name)) {
			throw new Error('invalid name')
		}
		this.domain = extra?.domain
		this.reference = extra?.reference
	}

	// Creates new `Ref` by replacing a domain with given value.
	withDomain(domain: string): Ref {
		return new Ref(this.name, { domain, reference: this.reference })
	}

	// Creates new `Ref` by replacing a reference with given value.
	withReference(reference: Reference): Ref {
		return new Ref(this.name, { domain: this.domain, reference })
	}

	toString(): string {
		let s = this.name
		if (this.domain !== undefined) {
			s = `${this.domain}/${s}`
		}
		if (this.reference !== undefined) {
			if (this.reference instanceof Digest) {
				s = `${s}@${this.reference}`
			} else {
				s = `${s}:${this.reference}`
			}
		}

		return s
	}
}
