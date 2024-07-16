export class ResError extends Error {
	constructor(
		readonly res: Response,
		message?: string,
	) {
		super(message)
	}
}
