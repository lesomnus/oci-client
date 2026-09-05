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
	// Methods like `map` construct their result with the species, which would
	// invoke the constructor with a length instead of the components.
	static get [Symbol.species]() {
		return Array
	}

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

/** Algorithms that {@link Digest.of} can compute. */
export type DigestAlgorithm = 'sha256' | 'sha512'

const SubtleAlgorithms: Record<DigestAlgorithm, string> = {
	sha256: 'SHA-256',
	sha512: 'SHA-512',
}

function hex(v: ArrayBuffer): string {
	return Array.from(new Uint8Array(v))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
}

export class Digest {
	#algorithm: HashAlgorithm
	#encoded: string

	/**
	 * Digests the given data, which is what a blob has to be identified by
	 * before it can be pushed.
	 *
	 * Note that it is computed by the Web Crypto API, which a browser serves
	 * only in a secure context; use a {@link Hasher} with {@link BlobsApiV2.startUpload}
	 * for the data that is too large to be held at once.
	 *
	 * @example
	 * ```ts
	 * const data = new TextEncoder().encode('...')
	 * await repo.blobs.upload(await Digest.of(data), data).unwrap()
	 * ```
	 */
	static async of(data: BufferSource | Blob, algorithm: DigestAlgorithm = 'sha256'): Promise<Digest> {
		if (globalThis.crypto?.subtle === undefined) {
			throw new Error('Web Crypto is not available, which a browser serves only in a secure context')
		}

		const bytes = data instanceof Blob ? await data.arrayBuffer() : data
		const v = await globalThis.crypto.subtle.digest(SubtleAlgorithms[algorithm], bytes)
		return new Digest(algorithm, hex(v))
	}

	static parse(text: string) {
		const i = text.indexOf(':')
		if (i < 0) {
			throw new SyntaxError('digest must be formed as "<algorithm>:<encoded>"')
		}

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
