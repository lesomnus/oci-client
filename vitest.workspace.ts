import { defineWorkspace } from 'vitest/config'

// FIXME: providerOptions type hint not working.

export default defineWorkspace([
	{
		extends: './vite.config.ts',
		test: {
			globals: true,
			environment: 'node',
		},
	},
	{
		test: {
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
