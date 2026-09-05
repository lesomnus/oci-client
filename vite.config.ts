import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

import { playwright } from '@vitest/browser-playwright'
import dts from 'vite-plugin-dts'
import { defaultExclude, defineConfig } from 'vitest/config'

const SrcRoot = resolve(import.meta.dirname, 'src')
const OutRoot = resolve(import.meta.dirname, 'dist')

/**
 * Rewrites the module specifiers of an emitted declaration file so that a
 * consumer can resolve them.
 *
 * Two kinds of specifier are not resolvable as emitted:
 *
 * - `~/*`, the path alias of this repository. The alias is rewritten in import
 *   statements but not in the `import("...")` types that the declaration
 *   emitter synthesizes for an inferred type.
 * - A relative specifier without an extension, which "moduleResolution":
 *   "nodenext" rejects, and which is ambiguous where a sibling file and a
 *   directory share a name; `./media-types` is both `media-types.js`, the
 *   bundle, and `media-types/`, the declarations.
 *
 * The declarations mirror the source tree, so a specifier is resolved against
 * `src` and emitted back as an explicit relative path with a `.js` extension.
 */
function resolveSpecifiers(filePath: string, content: string) {
	// Map the emitted file back onto the source directory it was emitted from.
	const dir = resolve(SrcRoot, relative(OutRoot, dirname(filePath)))

	const rewrite = (spec: string) => {
		let target: string
		if (spec.startsWith('~/')) {
			target = resolve(SrcRoot, spec.slice(2))
		} else if (spec.startsWith('.')) {
			target = resolve(dir, spec)
		} else {
			// A bare specifier; it is resolved by the consumer.
			return spec
		}

		if (!existsSync(`${target}.ts`)) {
			if (!existsSync(resolve(target, 'index.ts'))) {
				// Left as emitted it would only fail in a consumer's build, so
				// the build is failed here instead.
				throw new Error(`declaration "${filePath}" refers to "${spec}", which is not a source file`)
			}
			target = resolve(target, 'index')
		}

		const rel = relative(dir, target)
		return `${rel.startsWith('.') ? rel : `./${rel}`}.js`
	}

	// A statement keeps the quotes of the source but a synthesized `import(...)`
	// type is emitted with double quotes, so both are matched.
	const Specifier = /(\bfrom\s*|\bimport\()(['"])([^'"]+)\2/g

	return content.replaceAll(Specifier, (_, head, quote, spec) => `${head}${quote}${rewrite(spec)}${quote}`)
}

export default defineConfig({
	plugins: [
		dts({
			exclude: ['vite.config.ts', 'src/**/*.test.ts', 'src/testutils/**'],
			beforeWriteFile(filePath, content) {
				if (!filePath.endsWith('.d.ts')) return
				return { content: resolveSpecifiers(filePath, content) }
			},
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
					exclude: [
						...defaultExclude,
						// `helm` is a CLI so it cannot be executed in the browser.
						'src/media-types/vnd/cncf/helm.test.ts',
						// The credential of the hosted registries would be
						// inlined into the bundle that is served to the browser.
						'src/hosted.test.ts',
					],
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
