/**
 * Media types of a WebAssembly module distributed as an OCI artifact.
 *
 * @see {@link https://github.com/opencontainers/artifacts/blob/main/artifact-authors.md | Artifact Authors Guidance}
 */
export namespace wasm {
	export const configV1 = 'application/vnd.wasm.config.v1+json'
	export const contentLayerV1 = 'application/vnd.wasm.content.layer.v1+wasm'
}
