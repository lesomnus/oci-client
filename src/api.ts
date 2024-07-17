import { ResError } from './error'
import type { Ref, Reference } from './ref'
import { type Probe, type Result, probe, result } from './result'
import type { Endpoint, ReqInit, Transport } from './transport'

/**
 * @see {@link https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types | Distributive Conditional Types}
 */
// biome-ignore lint/suspicious/noExplicitAny: it has to be
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

type Ep<R extends string, M extends string> = DistributiveOmit<Extract<Endpoint, { resource: R; method: M }>, 'method' | 'name' | 'resource'>

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
		return `https://${this.ref.domain}/v2/${this.ref.name}`
	}

	protected async exec<M extends string>(resource: string, endpoint: Ep<R, M>, init?: ReqInit) {
		const raw = await this.transport.fetch(resource, {
			...init,
			endpoint: {
				...endpoint,
				method: init?.method ?? 'GET',
				name: this.ref.name,
				resource: this.resource,
			} as Endpoint,
		})
		if (raw.status >= 500) {
			throw new ResError(raw, 'server error')
		}

		return raw
	}

	protected async _get<T extends Result>(resource: string, endpoint: Ep<R, 'GET'>, init?: ReqInit): Promise<T> {
		const raw = await this.exec(resource, endpoint, { ...init, method: 'GET' })
		const msg = await raw.json()
		return result({ raw, ...msg })
	}

	protected async _head(resource: string, endpoint: Ep<R, 'HEAD'>, init?: ReqInit): Promise<Probe> {
		const raw = await this.exec(resource, endpoint, { ...init, method: 'HEAD' })
		return probe(raw)
	}
}

export type ManifestsApiV2GetRes = Result

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
		return `${this.urlPrefix}/manifests/${reference}`
	}

	async get(reference?: Reference) {
		reference = this.#fallbackReference(reference)
		const u = this.#u(reference)
		return this._get<ManifestsApiV2GetRes>(u, { reference })
	}

	async exists(reference?: Reference) {
		reference = this.#fallbackReference(reference)
		const u = this.#u(reference)
		return this._head(u, { reference })
	}
}

export type TagsApiV2ListOpts = { n?: number; last?: string }
export type TagsApiV2ListRes = Result<{
	name: string
	tags: string[]
}>

export class TagsApiV2 extends ApiBase<'tags'> {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {
		super(transport, ref, 'tags')
	}

	// end-8
	async list(opts?: TagsApiV2ListOpts) {
		if (opts?.n && opts.n < 0) {
			throw new Error('"n" cannot be negative number')
		}

		const u = `${this.urlPrefix}/tags/list${makeParams(opts)}`
		return this._get<TagsApiV2ListRes>(u, { action: 'list', ...opts })
	}
}
