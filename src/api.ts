import { Chunk } from './chunk'
import { Digest, type Hasher } from './digest'
import type { Endpoint } from './endpoint'
import type { MediaType } from './media-type'
import type { oci } from './media-types'
import { Range } from './range'
import { Ref, type Reference } from './ref'
import { type Probe, type Req, probe, result } from './result'
import type { Transport } from './transport'

/**
 * @see {@link https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types | Distributive Conditional Types}
 */
// biome-ignore lint/suspicious/noExplicitAny: it has to be
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

type Ep<R extends string, M extends string> = DistributiveOmit<
	Extract<Endpoint, { resource: R; method: M }>,
	'method' | 'name' | 'resource'
>

function normalizeLocation(l: string, domain?: string): URL {
	if (l.startsWith('http://') || l.startsWith('https://')) {
		return new URL(l)
	}
	if (domain !== undefined) {
		return new URL(`https://${domain}${l}`)
	}

	return new URL(`${window.location.origin}${l}`)
}

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

export class BlobsV2Upload {
	#client: BlobsApiV2
	#hasher: Hasher

	// It is set by negative number if this upload session is closed.
	#pos: number

	#location: Promise<URL>
	#buffer = new Uint8Array(4 * 1024 * 1024)

	constructor(transport: Transport, ref: Ref, hash: Hasher) {
		this.#client = new BlobsApiV2(transport, ref)
		this.#hasher = hash
		this.#pos = 0

		this.#location = this.#client
			.initUpload()
			.unwrap()
			.then(({ location, chunkMinLength }) => {
				if (chunkMinLength !== undefined && chunkMinLength < this.#buffer.byteLength) {
					this.#buffer = new Uint8Array(chunkMinLength)
				}
				return location
			})
	}

	#toReadableStream(data: BufferSource | Blob | ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
		if (data instanceof ReadableStream) {
			return data
		}
		if (!(data instanceof Blob)) {
			data = new Blob([data])
		}

		return data.stream()
	}

	write(data: BufferSource | Blob | ReadableStream<Uint8Array>) {
		const s = this.#toReadableStream(data)
		const r = s.getReader({ mode: 'byob' })

		this.#location = this.#location.then(async l => {
			while (true) {
				const { value, done } = await r.read(this.#buffer)
				if (value) {
					this.#buffer = new Uint8Array(value.buffer)
				}
				if (done) {
					break
				}

				const chunk = new Chunk(value, this.#pos)
				this.#pos += value.byteLength

				const req = this.#client.uploadChunk(l, chunk).unwrap()
				this.#hasher.update(value)

				const { location } = await req
				l = location
			}

			return l
		})

		return this.#location as unknown as Promise<void>
	}

	close() {
		if (this.#pos < 0) {
			return this.#location
		}

		this.#location = this.#location.then(async l => {
			const encoded = this.#hasher.digest()
			const digest = new Digest(this.#hasher.name, encoded)
			this.#pos = -1

			const { location } = await this.#client.closeUpload(l, digest).unwrap()
			return location
		})
		return this.#location
	}
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

	protected exec<M extends string>(resource: URL | string, endpoint: Ep<R, M>, init?: RequestInit): Promise<Response> {
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

	protected async _head(resource: string, endpoint: Ep<R, 'HEAD'>, init?: RequestInit): Promise<Probe> {
		const raw = await this.exec(resource, endpoint, { ...init, method: 'HEAD' })
		return probe(raw)
	}

	protected _get<T extends {}>(resource: string, endpoint: Ep<R, 'GET'>, init?: RequestInit): Req<T> {
		const req = this.exec(resource, endpoint, { ...init, method: 'GET' })
		return result(req, res => res.json())
	}

	protected _delete<T extends {}>(resource: string, endpoint: Ep<R, 'DELETE'>, init?: RequestInit): Req<T> {
		const req = this.exec(resource, endpoint, { ...init, method: 'DELETE' })
		return result(req, res => Promise.resolve({}))
	}
}

export type BlobsApiV2InitUploadRes = {
	location: URL
	chunkMinLength?: number
}

export type BlobsApiV2UploadChunkRes = {
	location: URL
	range: unknown
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
	 * Checks if a blob identified by `digest` exists in the registry.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#checking-if-content-exists-in-the-registry | Checking if content exists in the registry}* `end-2`.
	 */
	exists(digest: string | Digest) {
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}

		const u = this.#u(digest)
		return this._head(u, { digest })
	}

	/**
	 * Retrieve the blob from the registry identified by `digest`.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pulling-blobs | Pulling blobs}* `end-2`.
	 */
	get(digest: string | Digest) {
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}

		const u = this.#u(digest)
		const req = this.exec(u, { digest }, { method: 'GET' })
		return result(req, () => Promise.resolve({}))
	}

	/**
	 * Obtains a session ID to pushing a blob monolothically or in chunks.
	 * This can be used to offload traffic instead of uploading it with single request using {@link upload}.
	 *
	 * @see {@link uploadChunk} to upload a chunk to the session at `location` returned by this request.
	 * @see {@link startUpload} to get high-level interface.
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#post-then-put | POST then PUT}* `end-4a`.
	 *
	 * @example
	 * ```ts
	 * let { location } = await blobs.initUpload().unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk1).unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk2).unwrap()
	 * await blobs.closeUpload().unwrap()
	 * ```
	 *
	 * @returns `202 Accepted` on success.
	 */
	initUpload(): Req<BlobsApiV2InitUploadRes> {
		const u = `${this.urlPrefix}/uploads/`
		const req = this.exec<'POST'>(u, { action: 'uploads' }, { method: 'POST' })
		return result(req, res => {
			const { headers } = res
			const l = headers.get('Location') as string
			const location = normalizeLocation(l, this.ref.domain)
			const chunkMinLength = Number.parseInt(headers.get('OCI-Chunk-Min-Length') ?? '')

			return Promise.resolve({ location, chunkMinLength })
		})
	}

	/**
	 * Uploads a chunk to the session at `location` returned by {@link initUpload} or the previous {@link uploadChunk}.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-a-blob-in-chunks | Pushing a blob in chunks}* `end-5`.
	 *
	 * @example
	 * ```ts
	 * let { location } = await blobs.initUpload().unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk1).unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk2).unwrap()
	 * await blobs.closeUpload().unwrap()
	 * ```
	 *
	 * @returns `202 Accepted` on success.
	 * @returns `416 Range Not Satisfiable` if a chunk is uploaded out of order.
	 */
	uploadChunk(location: URL | string, chunk: Chunk): Req<BlobsApiV2UploadChunkRes> {
		const action = 'uploads'
		if (typeof location === 'string') {
			location = new URL(location)
		}

		const req = this.exec<'PATCH'>(
			location,
			{ action, location },
			{
				method: 'PATCH',
				headers: {
					'Content-Length': chunk.length.toString(),
					'Content-Range': chunk.range.toString(),
					'Content-Type': 'application/octet-stream',
				},
				body: chunk.data,
			},
		)
		return result(req, res => {
			const l = res.headers.get('Location') as string
			const location = normalizeLocation(l, this.ref.domain)
			return Promise.resolve({ location })
		})
	}

	/**
	 * Close the upload session at `location` provided by {@link initUpload} or the previous {@link uploadChunk}.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-a-blob-in-chunks | Pushing a blob in chunks}* `end-6`.
	 *
	 * @example
	 * ```ts
	 * let { location } = await blobs.initUpload().unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk1).unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk2).unwrap()
	 * await blobs.closeUpload().unwrap()
	 * ```
	 *
	 * @param digest Digest of the whole blob (not the final chunk).
	 *
	 * @returns `201 Created` on success.
	 */
	closeUpload(location: URL | string, digest: string | Digest, chunkOrData?: Chunk | BufferSource | Blob | ReadableStream) {
		const action = 'uploads'
		if (typeof location === 'string') {
			location = new URL(location)
		}
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}

		let chunk: Chunk | undefined
		if (chunkOrData === undefined) {
			chunk = undefined
		} else if (chunkOrData instanceof Chunk) {
			chunk = chunkOrData
		} else if (!(chunkOrData instanceof ReadableStream)) {
			chunk = new Chunk(chunkOrData)
		}

		const init = {
			method: 'PUT',
			headers: {} as Record<string, string>,
			body: chunk ? chunk.data : (chunkOrData as ReadableStream),
		}
		if (chunk) {
			init.headers['Content-Length'] = chunk.length.toString()
		}
		if (chunkOrData instanceof Chunk) {
			init.headers['Content-Range'] = chunkOrData.range.toString()
		}
		if (chunkOrData !== undefined) {
			init.headers['Content-Type'] = 'application/octet-stream'
		}

		location.searchParams.append('digest', digest.toString())
		const req = this.exec<'PUT'>(location, { action, digest }, init)
		return result(req, res => {
			const l = res.headers.get('Location') as string
			const location = normalizeLocation(l, this.ref.domain)
			return Promise.resolve({ location })
		})
	}

	/**
	 * Creates a blob uploader.
	 *
	 * @see {@link initUpload} to upload a blob with more fine-grained control.
	 * @example
	 * ```ts
	 * const upload = blobs.startUpload(sha256Hasher)
	 * await upload.write(chunk1)
	 * await upload.write(chunk2)
	 * const { location } = await upload.close()
	 * ```
	 */
	startUpload(hasher: Hasher): BlobsV2Upload {
		return new BlobsV2Upload(this.transport, this.ref, hasher)
	}

	/**
	 * Retrieves the current status of upload session at `location` provided by {@link initUpload} or the previous {@link uploadChunk}.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-a-blob-in-chunks | Pushing a blob in chunks}* `end-13`.
	 *
	 * @example
	 * ```ts
	 * let { location } = await blobs.initUpload().unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk1).unwrap()
	 * ;{ location, range } = await blobs.getUploadStatus(location).unwrap()
	 * ;{ location } = await blobs.uploadChunk(location, chunk2).unwrap()
	 * await blobs.closeUpload().unwrap()
	 * ```
	 */
	getUploadStatus(location: URL | string) {
		const action = 'uploads'
		if (typeof location === 'string') {
			location = new URL(location)
		}

		const req = this.exec<'GET'>(location, { action, location }, { method: 'GET' })
		return result(req, res => {
			const l = res.headers.get('Location') as string
			const location = normalizeLocation(l, this.ref.domain)
			const r = res.headers.get('Range') as string
			const range = Range.parse(r)
			return Promise.resolve({ location, range })
		})
	}

	/**
	 * Uploads a blob with a single request.
	 *
	 * If the registry does not support single request monolithic uploads,
	 * a `location` is returned and uploads can be proceed using {@link uploadChunk}.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#single-post | Single POST}* `end-4b`.
	 *
	 * @param digest Digest of the `chunk`.
	 *
	 * @returns `201 Created` on success.
	 * @returns `202 Accepted` if the registry does not support single request monolithic uploads.
	 */
	upload(digest: string | Digest, chunk: Chunk) {
		const action = 'uploads'
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}

		const u = `${this.urlPrefix}/uploads/?digest=${digest.toString()}`
		const req = this.exec<'POST'>(
			u,
			{ action, digest },
			{
				method: 'POST',
				headers: {
					'Content-Length': chunk.length.toString(),
					'Content-Type': 'application/octet-stream',
				},
				body: chunk.data,
			},
		)
		return result(req, res => {
			const l = res.headers.get('Location')
			let location: URL | undefined = undefined
			if (l !== null) {
				location = normalizeLocation(l, this.ref.domain)
			}

			return Promise.resolve({ location })
		})
	}

	/**
	 * Mounts a blob from another repository.
	 * The blob is identified by its name so `from.domain` and `from.reference` is ignored.
	 *
	 * If the registry does not support cross-repository mounting or is unable to mount the requested blob,
	 * uploads can be proceed using {@link uploadChunk} with returned `location`.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#mounting-a-blob-from-another-repository | Mounting a blob from another repository}* `end-11`.
	 *
	 * @returns `201 Created` on success.
	 * @returns `202 Accepted` if the registry does not support cross-repository mounting or is unable to mount the requested blob.
	 */
	mount(mount: Digest | string, from?: Ref | string) {
		const action = 'uploads'
		if (typeof mount === 'string') {
			mount = Digest.parse(mount)
		}
		if (typeof from === 'string') {
			from = new Ref(from)
		}

		const params = makeParams({
			mount: mount.toString(),
			from: from?.name,
		})

		const u = `${this.urlPrefix}/uploads/${params}`
		const req = this.exec<'POST'>(u, { action, mount, from }, { method: 'POST' })
		return result(req, res => {
			const l = res.headers.get('Location') as string
			const location = normalizeLocation(l, this.ref.domain)
			return Promise.resolve({ location })
		})
	}

	/**
	 * Deletes a blob identified by `digest`.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#deleting-blobs | Deleting Blobs}* `end-10`.
	 *
	 * @returns `202 Accepted` on success.
	 * @returns `404 Not Found` if the blob not found.
	 */
	delete(digest: Digest) {
		const u = this.#u(digest)
		return this._delete(u, { digest })
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
	 * Checks if a manifest identified by `reference` exists in the registry.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#checking-if-content-exists-in-the-registry | Checking if content exists in the registry}* `end-3`.
	 */
	exists(reference?: Reference) {
		reference = this.#fallbackReference(reference)
		const u = this.#u(reference)
		return this._head(u, { reference })
	}

	/**
	 * Retrieves a manifest identified by `reference`.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pulling-manifests | Pulling manifests}* `end-3`.
	 */
	get(reference?: Reference) {
		reference = this.#fallbackReference(reference)
		const u = this.#u(reference)
		return this._get(u, { reference })
	}

	/**
	 * Pushes a manifest identified by `reference`.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-manifests | Pushing Manifests}* `end-7`.
	 *
	 * @returns `201 Created` on success.
	 */
	put(reference: Reference, contentType: MediaType, body: BodyInit, init?: RequestInit) {
		const u = this.#u(reference)
		const req = this.exec(
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

		return result(req, res =>
			Promise.resolve({
				location: res.headers.get('Location') as string,
			}),
		)
	}

	/**
	 * Deletes a manifest identified by `reference`.
	 *
	 * @see Spec *{@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#deleting-manifests | Deleting Manifests}* `end-9`.
	 *
	 * @returns `202 Accepted` on success.
	 * @returns `404 Not Found` if the blob not found.
	 */
	delete(reference: Reference) {
		const u = this.#u(reference)
		return this._delete(u, { reference })
	}
}

export type ReferrersApiV2GetOpts = {
	artifactType?: string
}
export type ReferrersApiV2GetRes = oci.image.IndexV1<
	| typeof oci.image.indexV1 //
	| typeof oci.image.manifestV1
>

export class ReferrersApiV2 extends ApiBase<'referrers'> {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {
		super(transport, ref, 'referrers')
	}

	#u(digest: Digest) {
		return `${this.urlPrefix}/${digest.toString()}`
	}

	/**
	 * Retrieves a list of referrers identified by `digest`.
	 *
	 * If the registry supports referrers APIs, `404 Not Found` is NOT returned.
	 *
	 * @see Spec {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#listing-referrers | Listing Referrers} `end-12`.
	 *
	 * @returns `200 OK` on success.
	 */
	get(digest: string | Digest, opts?: ReferrersApiV2GetOpts): Req<ReferrersApiV2GetRes> {
		if (typeof digest === 'string') {
			digest = Digest.parse(digest)
		}

		const u = `${this.#u(digest)}${makeParams(opts)}`
		return this._get(u, { ...opts })
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

	/**
	 * Retrieves a list of tags in the repository.
	 *
	 * @see Spec {@link https://github.com/opencontainers/distribution-spec/blob/main/spec.md#listing-tags | Listing Tags} `end-8`.
	 *
	 * @returns `200 OK` on success.
	 */
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

	get referrers(): ReferrersApiV2 {
		return new ReferrersApiV2(this.transport, this.ref)
	}

	get tags(): TagsApiV2 {
		return new TagsApiV2(this.transport, this.ref)
	}
}
