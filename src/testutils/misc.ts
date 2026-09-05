import { Digest } from '../digest'

export function encodeString(data: string): Uint8Array<ArrayBuffer> {
	const encoder = new TextEncoder()
	return encoder.encode(data)
}

export function hash(data: BufferSource | Blob): Promise<Digest> {
	return Digest.of(data)
}

export function toRecord<T extends { key: string }>(vs: T[]) {
	return vs.reduce(
		(o, { key, ...v }) => {
			o[key] = v
			return o
		},
		{} as Record<string, Omit<T, 'key'>>,
	)
}
