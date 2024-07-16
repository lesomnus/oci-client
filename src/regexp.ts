const Patterns = {
	Digest: {
		AlgorithmComponent: /^[a-z0-9]+$/,
		AlgorithmSeparator: /[+._-]/,
		Encoded: /^[a-zA-Z0-9=_-]+$/,

		Sha256: /^[a-f0-9]{64}$/,
		Sha512: /^[a-f0-9]{128}$/,
	},
	Reference: {
		Domain: /^[^:/$\s]{1,}(:\d{1,})?$/,
		Name: /^[a-z0-9]+((\.|_|__|-+)[a-z0-9]+)*(\/[a-z0-9]+((\.|_|__|-+)[a-z0-9]+)*)*$/,
		Tag: /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/,
	},
}

export default Patterns
