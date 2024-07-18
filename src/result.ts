import { ResError } from './error'

type ResBase = {
	raw: Response
}

export type ErrorEntry = {
	code: string
	message: string
	detail: string
}

export type ErrorResponse = {
	errors: ErrorEntry[]
}

export type Res<T extends ResBase = ResBase> = ResBase & (T | ErrorResponse)

type As = {
	/**
	 * Returns a structured message as-is with the type defined by the given `mediaType`.
	 * Note that it does not validate or modify the message.
	 *
	 * @example
	 * ```ts
	 * const res = await client
	 *   .repo('library/node')
	 *   .manifests.get()
	 *
	 * const v = res.unwrap().as(oci.image.indexV1)
	 * console.log(v.manifests[0].platform.os) // 'linux'
	 * ```
	 */
	as<U>(mediaType: string | U): undefined | U
}

export type Result<T extends {} = Res> = ResBase & {
	/**
	 * Returns a structured message if the response is not an error,
	 * but it throws {@link ResError} after invoking `cb` if the response is an error.
	 *
	 * @example
	 * ```ts
	 * // Assume `res` an error.
	 * const v = res.unwrap() // throws `ResError`
	 * const v = res.unwrap(() => { throw new Error('...') }) // throws `Error`
	 * ```
	 */
	unwrap(cb?: (errors: ErrorEntry[]) => void): never | Promise<ResBase & T & As>
}

export async function result<T extends {}>(raw: Response, onSuccess: () => Promise<T>): Promise<Result<T>> {
	if (raw.status >= 500) {
		throw new ResError(raw, 'server error')
	}
	if (raw.status >= 400) {
		let getV: Promise<ErrorEntry[]> | undefined
		return {
			raw,
			async unwrap(cb) {
				if (getV === undefined) {
					const t = raw.headers.get('Content-Type')
					if (t?.includes('application.json')) {
						getV = raw.json().then(v => v.errors)
					} else {
						getV = Promise.resolve([])
					}
				}

				const errors = await getV
				cb?.(errors)
				throw new ResError(raw, 'expected a result but was an error')
			},
		}
	}

	let getV: Promise<T> | undefined
	const rst = {
		raw,
		async unwrap() {
			if (getV === undefined) {
				getV = onSuccess()
			}

			const v = await getV
			return {
				raw,
				...v,
				as<U>(mediaType: string | U): undefined | U {
					const t = this.raw.headers.get('Content-Type')
					if (t !== null && t === mediaType) {
						return v as unknown as U
					}
					if ('mediaType' in v && v.mediaType === mediaType) {
						return v as unknown as U
					}

					return undefined
				},
			}
		},
	}

	return rst
}

export type Probe = ResBase & { ok: boolean }

export function probe(raw: Response): Probe {
	switch (raw.status) {
		case 200:
			return { raw, ok: true }
		case 404:
			return { raw, ok: false }

		default:
			throw new ResError(raw, `unexpected status code: ${raw.status}`)
	}
}
