import { Chunk } from '../chunk'
import { oci } from '../media-types'
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
			return {
				...init,
				bytes,
				digest,
				ref: init.key,
				chunk: new Chunk(bytes),
				manifest: {
					schemaVersion: 2,
					mediaType: oci.image.manifestV1,
					config: oci.empty,
					layers: [
						{
							mediaType: 'application/octet-stream',
							digest: digest.toString(),
							size: bytes.byteLength,
						},
					],
				},
			}
		}),
	),
)

export const Artifacts = toRecord(
	await Promise.all(
		['application/foo', 'application/bar'].map(async key => {
			const manifest: oci.image.ManifestV1 = {
				schemaVersion: 2,
				mediaType: oci.image.manifestV1,
				artifactType: key,
				config: oci.empty,
				layers: [oci.empty],
				subject: (() => {
					const {
						bytes,
						digest,
						manifest: { mediaType },
					} = Images['v0.1.0']
					return {
						mediaType,
						digest: digest.toString(),
						size: bytes.length,
					}
				})(),
			}
			const bytes = encodeString(JSON.stringify(manifest))
			const digest = await hash(bytes)

			return { key, bytes, digest, manifest }
		}),
	),
)
