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

export type Result<T extends {} = Res> = ResBase &
	T & {
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
		unwrap(cb?: (errors: ErrorEntry[]) => void): never | (ResBase & T & As)
	}

export function result<T extends Res>(res: T): Result<T> {
	const isErr = 'errors' in res
	const rst = {
		...res,
		unwrap(cb?: (errors: ErrorEntry[]) => void) {
			if (isErr) {
				if (cb) cb(res.errors)
				throw new ResError(res.raw, 'expected a result but was an error')
			}
			return this
		},
		as<U>(mediaType: string | U): undefined | U {
			const t = this.raw.headers.get('Content-type')
			if (t !== null && t === mediaType) {
				return res as unknown as U
			}
			if ('mediaType' in res && res.mediaType === mediaType) {
				return res as unknown as U
			}

			return undefined
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
			return { raw, ok: true }

		default:
			throw new ResError(raw, `unexpected status code: ${raw.status}`)
	}
}
