import { resolve } from 'node:path'

import dts from 'vite-plugin-dts'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [
		dts({
			exclude: ['vite.config.ts', '*.test.ts'],
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
		globals: true,
		environment: 'jsdom',
		coverage: {
			enabled: true,
			provider: 'v8',
			reporter: ['html'],
		},
	},
})
