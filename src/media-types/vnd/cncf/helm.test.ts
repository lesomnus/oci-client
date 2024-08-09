import 'zx/globals'

import { ClientV2, Digest, FetchTransport, Unsecure } from '~/index'
import { vnd } from '~/media-types'
import T from '~/testutils'

$.quiet = true

describe.concurrent('helm', async () => {
	const Repo = 'helm-test/gibbs'
	const client = new ClientV2(T.env.Domain, {
		transport: [new Unsecure(), new FetchTransport()],
	})
	const repo = client.repo(Repo)

	beforeEach(() => {
		const tmp = tmpdir()
		cd(tmp)
		return () => fs.rm(tmp, { recursive: true, force: true })
	})

	test('push', async () => {
		const ChartFilename = 'gibbs/Chart.yaml'
		const PackageFilename = 'gibbs-0.1.0.tgz'
		await $`helm create gibbs`
		await $`helm package gibbs`
		expect(await fs.exists(PackageFilename)).to.be.true

		const res = await repo.manifests.get('0.1.0')
		if (res.raw.status !== 404) {
			const data = await res.unwrap()
			const v = data.as(vnd.oci.image.manifestV1)
			expect(v).not.to.be.undefined
			if (!v) throw new Error()

			await repo.manifests.delete('0.1.0').unwrap()
			await Promise.all([repo.blobs.delete(Digest.parse(v.config.digest)), repo.blobs.delete(Digest.parse(v.layers[0].digest))])

			{
				const res = await repo.manifests.get('0.1.0')
				expect(res.raw.status).to.eq(404)
			}
		}

		const config = JSON.stringify(YAML.parse(await fs.readFile(ChartFilename, 'utf8')))
		const configBlob = T.encodeString(config)
		const configDigest = await T.hash(configBlob)
		await repo.blobs.upload(configDigest, configBlob).unwrap()

		const content = await fs.readFile(PackageFilename)
		const contentDigest = await T.hash(content)
		await repo.blobs.upload(contentDigest, content).unwrap()

		const manifest: vnd.oci.image.ManifestV1 = {
			schemaVersion: 2,
			config: {
				mediaType: vnd.cncf.helm.configV1,
				digest: configDigest.toString(),
				size: configBlob.byteLength,
			},
			layers: [
				{
					mediaType: vnd.cncf.helm.contentV1,
					digest: contentDigest.toString(),
					size: content.byteLength,
				},
			],
		}
		const manifestBlob = T.encodeString(JSON.stringify(manifest))
		await repo.manifests.put('0.1.0', vnd.oci.image.manifestV1, manifestBlob).unwrap()

		await fs.remove(PackageFilename)
		await $`helm pull --plain-http oci://${T.env.Domain}/${Repo} --version 0.1.0`

		const contentPulled = await fs.readFile(PackageFilename)
		const contentPulledDigest = await T.hash(contentPulled)
		expect(contentDigest.toString()).to.eq(contentPulledDigest.toString())
	})
})
