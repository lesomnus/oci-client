// biome-ignore lint/complexity/noBannedTypes: will all schema a JSON? im not sure...
type AnyObject = {}

export type MediaType<T extends {} = AnyObject> = string | T
export function mediaType<T extends {} = AnyObject>(name: string) {
	return name as MediaType<T>
}
