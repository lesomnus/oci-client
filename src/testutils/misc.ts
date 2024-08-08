import { sha256 } from 'hash-wasm'

import { Digest } from '../digest'

export function encodeString(data: string): Uint8Array {
	const encoder = new TextEncoder()
	return encoder.encode(data)
}

export async function hash(data: Uint8Array): Promise<Digest> {
	const v = await sha256(data)
	return new Digest('sha256', v)
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
