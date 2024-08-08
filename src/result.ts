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

export type Unwrapped<T> = ResBase & T

type Unwrap<T> = {
	unwrapOr<U>(cb: (res: Response, errors: ErrorEntry[]) => U): Promise<Unwrapped<T> | U>

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
	unwrap(cb?: (res: Response, errors: ErrorEntry[]) => void): Promise<Unwrapped<T>> | never
}

export type Result<T extends {}> = ResBase & Unwrap<T>

export type Req<T extends {}> = Promise<Result<T>> & Result<T>

class ErrorEntries extends Array<ErrorEntry> {}

export function wrap<T extends {}>(req: Promise<Response>, resolve: (res: Response) => Promise<T>) {
	req = req.then(res => {
		if (res.status >= 500) {
			throw new ResError(res, 'server error')
		}

		return res
	})

	const unwrapOr: Req<T>['unwrapOr'] = async <U>(cb: (res: Response, errors: ErrorEntry[]) => U) => {
		const raw = await req
		try {
			const res = await resolve(raw)
			return { raw, ...res }
		} catch (e) {
			const errs = e instanceof ErrorEntries ? e : new ErrorEntries()
			const v = cb(raw, errs)
			return v
		}
	}
	const unwrap: Req<T>['unwrap'] = async (cb?: (res: Response, errors: ErrorEntry[]) => void) => {
		return unwrapOr((raw, errors) => {
			cb?.(raw, errors)
			throw new ResError(raw, 'expected a result but was an error')
		})
	}

	const rst = req.then(raw => ({ raw, unwrapOr, unwrap })) as Req<T>
	rst.unwrapOr = unwrapOr
	rst.unwrap = unwrap
	return rst
}

export function result<T extends {}>(req: Promise<Response>, onSuccess: (res: Response) => Promise<T>) {
	return wrap(req, async (raw: Response): Promise<T> => {
		if (raw.status >= 400) {
			let errors: ErrorEntry[] = []
			if (raw.headers.get('Content-Type')?.includes('application/json')) {
				errors = (await raw.json()).errors
			}

			throw new ErrorEntries(...errors)
		}

		const v = await onSuccess(raw)
		return { raw, ...v }
	})
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
