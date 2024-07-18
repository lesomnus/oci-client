export type MediaType<T = unknown> = string | T
export function mediaType<T = unknown>(name: string) {
	return name as MediaType<T>
}
