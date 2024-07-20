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

export type Result<T extends {}> = ResBase & {
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
	unwrap(cb?: (res: Response, errors: ErrorEntry[]) => void): never | Promise<ResBase & T & As>
}

export type Req<T extends {}> = Promise<ResBase & Result<T>> & {
	unwrap(cb?: (res: Response, errors: ErrorEntry[]) => void): Promise<ResBase & T & As>
}

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

export function result<T extends {}>(req: Promise<Response>, onSuccess: (res: Response) => Promise<T>): Req<T> {
	req = req.then(res => {
		if (res.status >= 500) {
			throw new ResError(res, 'server error')
		}

		return res
	})

	const unwrap = async (cb?: (res: Response, errors: ErrorEntry[]) => void): Promise<ResBase & T & As> => {
		const raw = await req
		if (raw.status >= 400) {
			let errors: ErrorEntry[] = []
			if (raw.headers.get('Content-Type')?.includes('application/json')) {
				errors = (await raw.json()).errors
			}

			cb?.(raw, errors)
			throw new ResError(raw, 'expected a result but was an error')
		}

		const v = await onSuccess(raw)
		return {
			raw,
			...v,
			as<U>(mediaType: string | U) {
				const t = raw.headers.get('Content-Type')
				if (t !== null && t === mediaType) {
					return v as unknown as U
				}
				if ('mediaType' in v && v.mediaType === mediaType) {
					return v as unknown as U
				}

				return undefined
			},
		}
	}

	const rst = req.then(raw => ({ raw, unwrap })) as Req<T>
	rst.unwrap = unwrap
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
