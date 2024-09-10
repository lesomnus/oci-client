import { resolve } from 'node:path'

import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [
		tsconfigPaths(),
		dts({
			exclude: ['vite.config.ts', 'src/**/*.test.ts'],
		}),
	],
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
		coverage: {
			enabled: true,
			provider: 'istanbul',
			reporter: ['html', 'lcov'],
		},
	},
})
