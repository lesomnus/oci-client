#!/usr/bin/env -S npx tsx
import 'zx/globals'

$.verbose = true

for (const tag of ['1.36-musl', '1.35-musl', '1.34-musl']) {
	await $`skopeo copy --all --dest-tls-verify=false \
		docker://busybox:${tag} \
		docker://registry:5000/library/busybox:${tag}`
}
