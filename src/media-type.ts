export type MediaType<T = unknown, S extends string = string> = (string & {}) | S
export function mediaType<T, S extends string>(t: T, v: S) {
	return v as MediaType<T, S>
}
