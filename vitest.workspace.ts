import tsconfigPaths from 'vite-tsconfig-paths'
import { defaultExclude, defineWorkspace } from 'vitest/config'

// FIXME: providerOptions type hint not working.

export default defineWorkspace([
	{
		extends: './vite.config.ts',
		plugins: [tsconfigPaths()],
		test: {
			globals: true,
			environment: 'node',
		},
	},
	{
		plugins: [tsconfigPaths()],
		test: {
			exclude: [...defaultExclude, 'src/media-types/vnd/cncf/helm.test.ts'],
			globals: true,
			browser: {
				enabled: true,
				name: 'chromium',
				provider: 'playwright',
				providerOptions: {
					launch: {
						args: ['--disable-web-security'],
					},
					context: {
						bypassCSP: true,
					},
				},
				headless: true,
				fileParallelism: true,
				screenshotFailures: false,
			},
		},
	},
])
