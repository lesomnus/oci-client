import type { Digest } from './digest'
import type { Reference } from './ref'

export type Endpoint = {
	name: string
} & (
	| { method: 'GET'; resource: 'blobs'; digest: Digest } // end-2
	| { method: 'HEAD'; resource: 'blobs'; digest: Digest } // end-2
	| { method: 'GET'; resource: 'manifests'; reference: Reference } // end-3
	| { method: 'HEAD'; resource: 'manifests'; reference: Reference } // end-3
	| { method: 'POST'; resource: 'blobs'; action: 'uploads'; digest?: Digest } // end-4
	| { method: 'PATCH'; resource: 'blobs'; action: 'uploads'; reference: Reference; digest?: Digest } // end-5
	| { method: 'PUT'; resource: 'blobs'; action: 'uploads'; reference: Reference; digest?: Digest } // end-6
	| { method: 'PUT'; resource: 'blobs'; action: 'manifests'; reference: Reference; digest?: Digest } // end-7
	| { method: 'GET'; resource: 'tags'; action: 'list'; n?: number; last?: string } // end-8
	| { method: 'DELETE'; resource: 'manifests'; reference: Reference } // end-9
	| { method: 'DELETE'; resource: 'blobs'; digest: Digest } // end-10
	| { method: 'POST'; resource: 'blobs'; action: 'uploads'; mount?: string; from?: string } // end-11
	| { method: 'GET'; resource: 'referrers'; artifactType?: string } // end-12
	| { method: 'GET'; resource: 'blobs'; action: 'uploads'; reference: Reference } // end-13
)
