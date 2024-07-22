// Based on https://www.rfc-editor.org/rfc/rfc7233.html
export class Range {
	static parse(text: string): Range {
		const i = text.indexOf('-')
		if (i === 0) {
			const p = Number.parseInt(text)
			if (Number.isNaN(p)) {
				throw new SyntaxError('invalid suffix')
			}

			return new Range(p)
		}

		const a = text.slice(0, i)
		const b = text.slice(i + 1)

		const p1 = Number.parseInt(a)
		if (Number.isNaN(p1)) {
			throw new SyntaxError('invalid first pos')
		}
		if (b === '') {
			return new Range(p1)
		}

		const p2 = Number.parseInt(b)
		if (Number.isNaN(p2)) {
			throw new SyntaxError('invalid last pos')
		}

		return new Range(p1, p2 - p1 + 1)
	}

	constructor(
		readonly pos: number,
		readonly length?: number,
	) {
		if (length === undefined) {
			return
		}

		// `pos` of -1 means end of the data.
		if (pos === -1 && length < 0) {
			this.pos = length
			this.length = undefined
			return
		}

		// Range from the end cannot be represented.
		// ... -5 -4 -3 -2 -1 0
		//         |-----|
		if (pos < 0 && (length < 0 || pos < -length)) {
			throw new RangeError('invalid range')
		}

		// Normalize length to be positive.
		if (length < 0) {
			this.pos += length + 1
			this.length = -length
		}

		// Position is negative and it ranged to the end.
		// It maybe (0 + 0) but the result is same.
		if (this.pos + (this.length ?? 0) === 0) {
			this.length = undefined
		}
	}

	toString(): string {
		if (this.pos < 0) {
			if (this.length === undefined) {
				return `-${-this.pos}`
			}

			return `-${-this.pos},0-${this.length + this.pos - 1}`
		}

		let end = this.length
		if (end !== undefined) {
			end += this.pos - 1
		}
		return `${this.pos}-${end ?? ''}`
	}
}
