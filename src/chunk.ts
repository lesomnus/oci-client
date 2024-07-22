import { Range } from './range'

export class Chunk {
	readonly data: BufferSource | Blob | ReadableStream
	readonly length: number
	readonly pos: number

	constructor(data: BufferSource | Blob, pos?: number)
	constructor(data: ReadableStream, length: number, pos?: number)
	constructor(data: BufferSource | Blob | ReadableStream, lengthOrPos?: number, pos?: number) {
		this.data = data
		if (data instanceof ReadableStream) {
			if (lengthOrPos === undefined) {
				throw new Error('length must be provided')
			}

			this.length = lengthOrPos
		} else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
			this.length = data.byteLength
			pos = lengthOrPos
		} else {
			this.length = data.size
			pos = lengthOrPos
		}

		this.pos = pos ?? 0
	}

	withPos(pos: number): Chunk {
		return this.data instanceof ReadableStream //
			? new Chunk(this.data, this.length, pos)
			: new Chunk(this.data, pos)
	}

	get range(): Range {
		return new Range(this.pos, this.length)
	}
}
