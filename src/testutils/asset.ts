import { Chunk } from '~/index'
import { vnd } from '~/media-types'

import { encodeString, hash, toRecord } from './misc'

export const HashOfNotExists = await hash(Uint8Array.from([1, 2, 3]))
export const EmptyObjectData = new Chunk(Uint8Array.from([...'{}'].map(c => c.charCodeAt(0))))
export const Images = toRecord(
	await Promise.all(
		[
			{
				key: 'v0.1.0',
				data: 'Revenge is a dish best served cold.',
			},
			{
				key: 'v0.2.0',
				data: 'Silly Caucasian girl likes to play with Samurai swords',
			},
			{
				key: 'v0.3.0',
				data: 'They will be things you will miss',
			},
		].map(async init => {
			const bytes = encodeString(init.data)
			const digest = await hash(bytes)
			const manifest = {
				schemaVersion: 2,
				mediaType: vnd.oci.image.manifestV1,
				config: vnd.oci.empty,
				layers: [
					{
						mediaType: 'application/octet-stream',
						digest: digest.toString(),
						size: bytes.byteLength,
					},
				],
			}

			// The manifest is kept as bytes so that it is pushed as it is
			// digested; a subject has to reference a manifest, not a blob.
			const manifestBytes = encodeString(JSON.stringify(manifest))
			const manifestDigest = await hash(manifestBytes)

			return {
				...init,
				bytes,
				digest,
				ref: init.key,
				chunk: new Chunk(bytes),
				manifest,
				manifestBytes,
				manifestDigest,
			}
		}),
	),
)

export const Artifacts = toRecord(
	await Promise.all(
		['application/foo', 'application/bar'].map(async key => {
			const manifest: vnd.oci.image.ManifestV1 = {
				schemaVersion: 2,
				mediaType: vnd.oci.image.manifestV1,
				artifactType: key,
				config: vnd.oci.empty,
				layers: [vnd.oci.empty],
				subject: (() => {
					const {
						manifestBytes,
						manifestDigest,
						manifest: { mediaType },
					} = Images['v0.1.0']
					return {
						mediaType,
						digest: manifestDigest.toString(),
						size: manifestBytes.byteLength,
					}
				})(),
			}
			const bytes = encodeString(JSON.stringify(manifest))
			const digest = await hash(bytes)

			return { key, bytes, digest, manifest }
		}),
	),
)
