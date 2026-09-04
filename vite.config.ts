import { resolve } from 'node:path'

import { playwright } from '@vitest/browser-playwright'
import dts from 'vite-plugin-dts'
import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [
		dts({
			exclude: ['vite.config.ts', 'src/**/*.test.ts', 'src/testutils/**'],
		}),
	],
	resolve: {
		tsconfigPaths: true,
	},
	// `REGISTRY_DOMAIN` is exposed to the tests through `import.meta.env`
	// since `process` is not available in the browser.
	envPrefix: ['VITE_', 'REGISTRY_'],
	build: {
		minify: false,
		lib: {
			entry: {
				main: resolve(import.meta.dirname, 'src/index.ts'),
				'media-types': resolve(import.meta.dirname, 'src/media-types/index.ts'),
			},
			formats: ['es', 'cjs'],
		},
	},
	server: {
		host: '0.0.0.0',
	},
	test: {
		// Reuse transformed modules between runs; it speeds up cold starts.
		fsModuleCache: true,
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['html', 'lcov'],
		},
		projects: [
			{
				resolve: { tsconfigPaths: true },
				envPrefix: ['VITE_', 'REGISTRY_'],
				test: {
					name: 'node',
					globals: true,
					environment: 'node',
				},
			},
			{
				resolve: { tsconfigPaths: true },
				envPrefix: ['VITE_', 'REGISTRY_'],
				test: {
					name: 'browser',
					// `helm` is a CLI so it cannot be executed in the browser.
					exclude: [...defaultExclude, 'src/media-types/vnd/cncf/helm.test.ts'],
					globals: true,
					fileParallelism: true,
					browser: {
						enabled: true,
						provider: playwright({
							launchOptions: {
								args: ['--disable-web-security'],
							},
							contextOptions: {
								bypassCSP: true,
							},
						}),
						// The name is set explicitly since it is used as a part of the repository
						// name by the tests, which cannot contain the default "browser (chromium)".
						instances: [{ browser: 'chromium', name: 'browser' }],
						headless: true,
						screenshotFailures: false,
					},
				},
			},
		],
	},
})
