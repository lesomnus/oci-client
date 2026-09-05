import { ResError } from './error'

export type ErrorEntry = {
	code: string
	message: string
	detail: string
}

export type ErrorResponse = {
	errors: ErrorEntry[]
}

/** Invoked with what the registry reported instead of a result. */
export type OnError<U> = (res: Response, errors: readonly ErrorEntry[]) => U

/**
 * What the registry answered, along with the response it came in.
 *
 * `ok` tells the two apart and narrows the rest, so a result can be read
 * without deciding what to do about an error:
 *
 * ```ts
 * const res = await repo.manifests.get('latest')
 * if (res.ok) {
 * 	res.value.as(vnd.oci.image.manifestV1)
 * } else {
 * 	res.errors.some(e => e.code === Codes.ManifestUnknown)
 * }
 * ```
 */
export type Res<T extends {}> = {
	/** The response as it came, whatever it says. */
	readonly raw: Response

	/**
	 * The value the registry answered with.
	 * It throws {@link ResError} after invoking `cb`, if given, where the
	 * registry answered with an error instead.
	 */
	unwrap(cb?: OnError<void>): T

	/**
	 * The value the registry answered with, or what `cb` returns where it
	 * answered with an error instead.
	 */
	unwrapOr<U>(cb: OnError<U>): T | U
} & (
	| { readonly ok: true; readonly value: T; readonly errors?: undefined }
	| { readonly ok: false; readonly value?: undefined; readonly errors: readonly ErrorEntry[] }
)

function resultOf<T extends {}>(raw: Response, value: T): Res<T> {
	return {
		raw,
		ok: true,
		value,
		unwrap: () => value,
		unwrapOr: () => value,
	}
}

function errorOf<T extends {}>(raw: Response, errors: readonly ErrorEntry[]): Res<T> {
	return {
		raw,
		ok: false,
		errors,
		unwrap(cb?: OnError<void>): T {
			cb?.(raw, errors)
			throw new ResError(raw, 'expected a result but was an error')
		},
		unwrapOr<U>(cb: OnError<U>): T | U {
			return cb(raw, errors)
		},
	}
}

// Thrown by a resolver to say that the response is an error rather than that
// it could not be handled.
class ErrorEntries extends Array<ErrorEntry> {
	// Methods like `map` construct their result with the species, which would
	// make an unrelated array be mistaken for an error response.
	static get [Symbol.species]() {
		return Array
	}
}

/**
 * A request that was sent.
 *
 * Awaiting it answers {@link Res}, which holds the response along with what it
 * says; `unwrap` answers the value alone. The response is read once however
 * many times either is asked for.
 *
 * @example
 * ```ts
 * // The value, or `ResError` where the registry answered with an error.
 * const tags = await repo.tags.list().unwrap()
 *
 * // The response, to read before deciding what an error means.
 * const res = await repo.manifests.get(reference)
 * if (res.raw.status === 404) {
 * 	return undefined
 * }
 * ```
 */
export class Req<T extends {}> implements PromiseLike<Res<T>> {
	#res: Promise<Res<T>>

	constructor(req: Promise<Response>, resolve: (raw: Response) => Promise<T>) {
		this.#res = (async () => {
			const raw = await req
			if (raw.status >= 500) {
				throw new ResError(raw, 'server error')
			}

			try {
				return resultOf(raw, await resolve(raw))
			} catch (e) {
				// Anything else than `ErrorEntries` means the response could not
				// be handled at all, which is not an error response; it is
				// propagated as-is so the reason is not lost.
				if (!(e instanceof ErrorEntries)) {
					throw e
				}

				return errorOf<T>(raw, e)
			}
		})()

		// The response is read as soon as it arrives, so a rejection nobody is
		// waiting for yet must not be reported as unhandled.
		this.#res.catch(() => {})
	}

	// It is a `PromiseLike` on purpose, so that awaiting a request waits for the
	// answer rather than handing back the request itself.
	// biome-ignore lint/suspicious/noThenProperty: it is meant to be awaited
	then<A = Res<T>, B = never>(
		onfulfilled?: null | ((value: Res<T>) => A | PromiseLike<A>),
		onrejected?: null | ((reason: unknown) => B | PromiseLike<B>),
	): Promise<A | B> {
		return this.#res.then(onfulfilled, onrejected)
	}

	/** @see {@link Res.unwrap} */
	async unwrap(cb?: OnError<void>): Promise<T> {
		return (await this.#res).unwrap(cb)
	}

	/** @see {@link Res.unwrapOr} */
	async unwrapOr<U>(cb: OnError<U>): Promise<T | U> {
		return (await this.#res).unwrapOr(cb)
	}
}

/**
 * Wraps a request of which response is resolved by `resolve`, which throws to
 * say that the response is an error.
 */
export function wrap<T extends {}>(req: Promise<Response>, resolve: (res: Response) => Promise<T>): Req<T> {
	return new Req(req, resolve)
}

/**
 * Wraps a request of which response is an error where its status says so, in
 * which case the entries the registry reported are read from the body.
 */
export function result<T extends {}>(req: Promise<Response>, onSuccess: (res: Response) => Promise<T>): Req<T> {
	return new Req(req, async raw => {
		if (raw.status >= 400) {
			let errors: ErrorEntry[] = []
			if (raw.headers.get('Content-Type')?.includes('application/json')) {
				try {
					errors = (await raw.json()).errors ?? []
				} catch {
					// The body is not a well-formed error response.
					// It is reported without entries rather than failing here.
				}
			}

			throw new ErrorEntries(...errors)
		}

		return onSuccess(raw)
	})
}

export type Probe = {
	raw: Response
	ok: boolean
}

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
