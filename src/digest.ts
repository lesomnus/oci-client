import Patterns from './regexp'

export type Hasher = {
	name: string
	update(data: Uint8Array): void
	digest(): string
}

const HashPatterns: Record<string, undefined | RegExp> = {
	sha256: Patterns.Digest.Sha256,
	sha512: Patterns.Digest.Sha512,
}

export class HashAlgorithm extends Array<string> {
	static parse(text: string) {
		const components = text.split(Patterns.Digest.AlgorithmSeparator)
		return new HashAlgorithm(components)
	}

	constructor(components: string[]) {
		if (components.length === 0) {
			throw new Error('at least one algorithm must be given')
		}

		super(components.length)
		for (const [i, component] of components.entries()) {
			if (!Patterns.Digest.AlgorithmComponent.test(component)) {
				throw new Error('invalid algorithm component')
			}

			this[i] = component
		}
	}

	toString(): string {
		return this.join('+')
	}
}

export class Digest {
	#algorithm: HashAlgorithm
	#encoded: string

	static parse(text: string) {
		const i = text.indexOf(':')
		const algo = HashAlgorithm.parse(text.slice(0, i))
		const data = text.slice(i + 1)
		return new Digest(algo, data)
	}

	constructor(algorithm: string | HashAlgorithm, encoded: string) {
		if (typeof algorithm === 'string') {
			algorithm = HashAlgorithm.parse(algorithm)
		}
		if (!Patterns.Digest.Encoded.test(encoded)) {
			throw new SyntaxError('invalid encoded string')
		}

		const pattern = algorithm.length === 1 ? HashPatterns[algorithm[0]] : undefined
		if (pattern?.test(encoded) === false) {
			throw new SyntaxError('invalid encoded string for the algorithm')
		}

		this.#algorithm = algorithm
		this.#encoded = encoded
	}

	get algorithm(): HashAlgorithm {
		return this.#algorithm
	}

	get encoded(): string {
		return this.#encoded
	}

	toString(): string {
		return `${this.#algorithm.toString()}:${this.encoded}`
	}
}
