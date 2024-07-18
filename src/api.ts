import { Digest } from './digest'
import type { Endpoint } from './endpoint'
import type { Ref, Reference } from './ref'
import { type Probe, type Result, probe, result } from './result'
import type { ReqInit, Transport } from './transport'

/**
 * @see {@link https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types | Distributive Conditional Types}
 */
// biome-ignore lint/suspicious/noExplicitAny: it has to be
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

type Ep<R extends string, M extends string> = DistributiveOmit<
	Extract<Endpoint, { resource: R; method: M }>,
	'method' | 'name' | 'resource'
>

function makeParams(obj?: Record<string, undefined | string | number>): string {
	if (obj === undefined) {
		return ''
	}

	const params = Object.entries(obj)
		.filter((e): e is [string, string | number] => e[1] !== undefined)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&')
	return params === '' ? '' : `?${params}`
}

class ApiBase<R extends string> {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
		readonly resource: R,
	) {}

	protected get urlPrefix(): string {
		return `https://${this.ref.domain}/v2/${this.ref.name}/${this.resource}`
	}

	protected exec<M extends string>(resource: string, endpoint: Ep<R, M>, init?: ReqInit) {
		return this.transport.fetch(resource, {
			...init,
			endpoint: {
				...endpoint,
				method: init?.method ?? 'GET',
				name: this.ref.name,
				resource: this.resource,
			} as Endpoint,
		})
	}

	protected async _head(resource: string, endpoint: Ep<R, 'HEAD'>, init?: ReqInit): Promise<Probe> {
		const raw = await this.exec(resource, endpoint, { ...init, method: 'HEAD' })
		return probe(raw)
	}

	protected async _get<T extends {}>(resource: string, endpoint: Ep<R, 'GET'>, init?: ReqInit): Promise<Result<T>> {
		const raw = await this.exec(resource, endpoint, { ...init, method: 'GET' })
		return result(raw, () => raw.json())
	}
}

export type BlobsApiV2UploadsRes = {
	location: string
}

export class BlobsApiV2 extends ApiBase<'blobs'> {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {
		super(transport, ref, 'blobs')
	}

	#u(reference: Reference) {
		return `${this.urlPrefix}/${reference}`
	}

	/**
	 * Checking if content exists in the registry.
	 *
	 * @see {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#checking-if-content-exists-in-the-registry | spec} / {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints | end-2}
	 */
	exists(digest: string | Digest) {
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}

		const u = this.#u(digest)
		return this._head(u, { digest })
	}

	/**
	 * Retrieve the blob from the registry identified by digest.
	 *
	 * @see {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pulling-blobs | spec} / {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints | end-2}
	 */
	async get(digest: string | Digest) {
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}

		const u = this.#u(digest)
		const raw = await this.exec(u, { digest }, { method: 'GET' })
		return result(raw, () => Promise.resolve({}))
	}

	/**
	 * Push a blob monolithically by using a single POST request.
	 *
	 * @see {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#single-post | spec} / {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints | end-4b}
	 */
	uploads(digest: string | Digest, body: BufferSource | Blob): Promise<Result<BlobsApiV2UploadsRes>>
	uploads(digest: string | Digest, body: ReadableStream, length: number): Promise<Result<BlobsApiV2UploadsRes>>
	async uploads(
		digest: string | Digest,
		body: BufferSource | Blob | ReadableStream,
		length?: number,
	): Promise<Result<BlobsApiV2UploadsRes>> {
		const action = 'uploads'
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}
		if (body instanceof ReadableStream) {
		} else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
			length = body.byteLength
		} else if (body instanceof Blob) {
			length = body.size
		}
		if (length === undefined) {
			throw new Error('length must be provided')
		}

		const u = `${this.urlPrefix}/uploads/?digest=${digest.toString()}`

		const raw = await this.exec<'POST'>(
			u,
			{ action, digest },
			{
				method: 'POST',
				headers: {
					'Content-Length': length.toString(),
					'Content-Type': 'application/octet-stream',
				},
				body,
			},
		)
		return result(raw, () =>
			Promise.resolve({
				location: raw.headers.get('Location') as string,
			}),
		)
	}
}

export class ManifestsApiV2 extends ApiBase<'manifests'> {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {
		super(transport, ref, 'manifests')
	}

	#fallbackReference(reference?: Reference): Reference {
		return reference ?? this.ref.reference ?? 'latest'
	}

	#u(reference: Reference) {
		return `${this.urlPrefix}/${reference}`
	}

	/**
	 * Checking if content exists in the registry.
	 *
	 * @see {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#checking-if-content-exists-in-the-registry | spec} / {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints | end-3}
	 */
	exists(reference?: Reference) {
		reference = this.#fallbackReference(reference)
		const u = this.#u(reference)
		return this._head(u, { reference })
	}

	/**
	 * Fetch the manifest identified by reference where reference can be a tag or digest.
	 *
	 * @see {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pulling-manifests | spec} / {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints | end-3}
	 */
	get(reference?: Reference) {
		reference = this.#fallbackReference(reference)
		const u = this.#u(reference)
		return this._get(u, { reference })
	}

	/**
	 * Put the manifest identified by reference where reference can be a tag or digest.
	 *
	 * @see {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-manifests | spec} / {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints | end-7}
	 */
	async put(reference: Reference, contentType: string, body: BodyInit, init?: RequestInit) {
		const u = this.#u(reference)
		const raw = await this.exec(
			u,
			{ reference },
			{
				...init,
				method: 'PUT',
				headers: {
					'Content-Type': contentType,
				},
				body,
			},
		)
		return result(raw, () =>
			Promise.resolve({
				location: raw.headers.get('Location') as string,
			}),
		)
	}
}

export type TagsApiV2ListOpts = { n?: number; last?: string }
export type TagsApiV2ListRes = {
	name: string
	tags: string[]
}

export class TagsApiV2 extends ApiBase<'tags'> {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {
		super(transport, ref, 'tags')
	}

	// end-8
	list(opts?: TagsApiV2ListOpts) {
		if (opts?.n && opts.n < 0) {
			throw new Error('"n" cannot be negative number')
		}

		const u = `${this.urlPrefix}/list${makeParams(opts)}`
		return this._get<TagsApiV2ListRes>(u, { action: 'list', ...opts })
	}
}

export class RepoV2 {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {
		if (ref.domain === undefined) {
			throw new Error('domain must be provided by Ref')
		}
	}

	get blobs(): BlobsApiV2 {
		return new BlobsApiV2(this.transport, this.ref)
	}

	get manifests(): ManifestsApiV2 {
		return new ManifestsApiV2(this.transport, this.ref)
	}

	get tags(): TagsApiV2 {
		return new TagsApiV2(this.transport, this.ref)
	}
}
