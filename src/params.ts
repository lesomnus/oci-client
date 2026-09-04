/**
 * Serializes the given object into a query string, including the leading "?".
 * Entries of which value is `undefined` are omitted, and an empty string is
 * returned if there is nothing to serialize.
 */
export function makeParams(obj?: Record<string, undefined | string | number>): string {
	if (obj === undefined) {
		return ''
	}

	const params = Object.entries(obj)
		.filter((e): e is [string, string | number] => e[1] !== undefined)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&')
	return params === '' ? '' : `?${params}`
}
