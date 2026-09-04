// `T` is a phantom type parameter: it is not part of the type itself but carries
// the shape of the message so that it can be recovered by inference where the
// media type is used, e.g. `manifests.get().unwrap().as(vnd.oci.image.indexV1)`.
// biome-ignore lint/correctness/noUnusedVariables: it is a phantom type parameter
export type MediaType<T = unknown, S extends string = string> = (string & {}) | S

// `t` only exists to infer `T`; it is never read.
// biome-ignore lint/correctness/noUnusedFunctionParameters: it is a phantom parameter
export function mediaType<T, S extends string>(t: T, v: S) {
	return v as MediaType<T, S>
}
