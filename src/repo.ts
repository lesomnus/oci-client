import { ManifestsApiV2, TagsApiV2 } from './api'
import type { Ref } from './ref'
import type { Transport } from './transport'

export class Repo {
	constructor(
		readonly transport: Transport,
		readonly ref: Ref,
	) {
		if (ref.domain === undefined) {
			throw new Error('domain must be provided by Ref')
		}
	}

	get manifests(): ManifestsApiV2 {
		return new ManifestsApiV2(this.transport, this.ref)
	}

	get tags(): TagsApiV2 {
		return new TagsApiV2(this.transport, this.ref)
	}
}
