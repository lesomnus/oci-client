import { ResError } from './error'
import type { Ref, Reference } from './ref'
import { type Probe, type Result, probe, result } from './result'
import type { Transport } from './transport'

class ApiBase {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {}

	protected get urlPrefix(): string {
		return `https://${this.ref.domain}/v2/${this.ref.name}`
	}

	protected async exec(resource: string, init?: RequestInit) {
		const raw = await this.transport.fetch(resource, init)
		if (raw.status >= 500) {
			throw new ResError(raw, 'server error')
		}

		return raw
	}

	protected async _get<T extends Result>(resource: string, init?: RequestInit): Promise<T> {
		const raw = await this.exec(resource, { ...init, method: 'GET' })
		const msg = await raw.json()
		return result({
			raw,
			...msg,
		})
	}

	protected async _head(resource: string, init?: RequestInit): Promise<Probe> {
		const raw = await this.exec(resource, { ...init, method: 'HEAD' })
		return probe(raw)
	}
}

export type ManifestsApiV2GetRes = Result

export class ManifestsApiV2 extends ApiBase {
	#u(reference?: Reference) {
		return `${this.urlPrefix}/manifests/${reference ?? this.ref.reference ?? 'latest'}`
	}

	async get(reference?: Reference) {
		const u = this.#u(reference)
		return this._get<ManifestsApiV2GetRes>(u)
	}
	async exists(reference?: Reference) {
		const u = this.#u(reference)
		return this._head(u)
	}
}

export type TagsApiV2ListOpts = { n?: number; last?: string }
export type TagsApiV2ListRes = Result<{
	name: string
	tags: string[]
}>

export class TagsApiV2 extends ApiBase {
	// end-8
	async list(opts?: TagsApiV2ListOpts) {
		let u = `${this.urlPrefix}/tags/list`
		if (opts !== undefined) {
			const params: string[] = []
			if (opts.n !== undefined && opts.n >= 0) {
				params.push(`n=${opts.n}`)
			}
			if (opts.last !== undefined) {
				params.push(`last=${opts.last}`)
			}

			if (params.length > 0) {
				u += `?${params.join('&')}`
			}
		}

		return this._get<TagsApiV2ListRes>(u)
	}
}
