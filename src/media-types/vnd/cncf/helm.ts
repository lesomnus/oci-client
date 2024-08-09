import { mediaType } from '~/media-types/t'

/**
 * @see {@link https://helm.sh/blog/helm-oci-mediatypes/#helm-media-types | Helm media types}
 */
export namespace helm {
	/**
	 * @see {@link https://helm.sh/docs/topics/charts/#the-chartyaml-file | spec}
	 * @see {@link https://github.com/helm/helm/blob/abdbe1ed342021e1eefc086e9f0b403c1167c41f/pkg/chart/metadata.go#L48 | definition at Helm code}
	 */
	export type ConfigV1 = {
		/** The chart API version. */
		apiVersion: string
		/** The name of the chart. */
		name: string
		/** A SemVer 2 version. */
		version: string
		/** A SemVer range of compatible Kubernetes versions. */
		kubeVersion?: string
		/** A single-sentence description of this project. */
		description?: string
		/** The type of the chart. */
		type?: 'application' | 'library'
		/** A list of keywords about this project. */
		keywords?: string[]
		/** The URL of this projects home page. */
		home?: string
		/** A list of URLs to source code for this project. */
		sources?: string[]
		/** A list of the chart requirements. */
		dependencies?: {
			/** The name of the chart. */
			name: string
			/** The version of the chart. */
			version: string
			/** The repository URL or alias. */
			repository?: string
			/** A yaml path that resolves to a boolean, used for enabling/disabling charts. */
			condition?: string
			/** Tags can be used to group charts for enabling/disabling together. */
			tags?: string[]
			/** ImportValues holds the mapping of source values to parent key to be imported. Each item can be a string or pair of child/parent sublist items. */
			'import-values'?: (string | { child: string; parent: string })[]
			/** Alias to be used for the chart. Useful when you have to add the same chart multiple times. */
			alias?: string
		}[]
		maintainers?: {
			/** The maintainers name. */
			name: string
			/** The maintainers email. */
			email?: string
			/** A URL for the maintainer. */
			url?: string
		}[]
		/** A URL to an SVG or PNG image to be used as an icon. */
		icon?: string
		/** The version of the app that this contains. Needn't be SemVer. Quotes recommended. */
		appVersion?: string
		/** Whether this chart is deprecated. */
		deprecated?: boolean
		/** A list of annotations keyed by name. */
		annotations?: Record<string, string>
	}
	export const configV1 = mediaType({} as ConfigV1, 'application/vnd.cncf.helm.config.v1+json')

	export const contentV1 = 'application/vnd.cncf.helm.chart.content.v1.tar+gzip'
	export const provenanceV1 = 'application/vnd.cncf.helm.chart.provenance.v1.prov'
}
