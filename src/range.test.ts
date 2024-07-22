import { Range } from './range'

describe('Range', () => {
	describe('constructor', () => {
		test.each<{
			given: ConstructorParameters<typeof Range>
			pos: number
			length?: number
		}>([
			{ given: [0, undefined], pos: 0, length: undefined },
			{ given: [1, undefined], pos: 1, length: undefined },
			{ given: [0, 1], pos: 0, length: 1 },
			{ given: [1, 2], pos: 1, length: 2 },
			//       1
			// 0 1 2 3
			//       |
			{ given: [-1, undefined], pos: -1, length: undefined },
			//       1
			// 0 1 2 3
			//       |
			{ given: [-1, 1], pos: -1, length: undefined },
			//     2 1
			// 0 1 2 3
			//     |--
			{ given: [-2, undefined], pos: -2, length: undefined },
			// 0 1 2 3
			//   ^
			{ given: [1, 1], pos: 1, length: 1 },
			// 0 1 2 3
			//   ^
			{ given: [1, -1], pos: 1, length: 1 },
			// 0 1 2 3
			//   |-|
			{ given: [2, -2], pos: 1, length: 2 },
			//       2 1
			// 0 1 2 3 4
			// --|   |--
			{ given: [1, -4], pos: -2, length: 4 },
			//     3 2 1
			// 0 1 2 3 4
			// |   |----
			{ given: [0, -4], pos: -3, length: 4 },
			//   4 3 2 1
			// 0 1 2 3 4
			//   |------
			{ given: [-1, -4], pos: -4, length: undefined },
			//       2 1
			// 0 1 2 3 4
			//       |--
			{ given: [-2], pos: -2, length: undefined },
			//         1
			// 0 1 2 3 4
			// |       |
			{ given: [0, -2], pos: -1, length: 2 },
		])('new Range($given.0, $given.1)', ({ given, ...expected }) => {
			const v = new Range(given[0], given[1])
			expect({ ...v }).to.eql(expected)
		})
	})
	describe('parse', () => {
		test.each<{
			given: string
			pos: number
			length?: number
		}>([
			{ given: '0-', pos: 0, length: undefined },
			{ given: '1-', pos: 1, length: undefined },
			{ given: '0-0', pos: 0, length: 1 },
			{ given: '1-1', pos: 1, length: 1 },
			{ given: '0-2', pos: 0, length: 3 },
			{ given: '1-2', pos: 1, length: 2 },
			{ given: '-1', pos: -1, length: undefined },
		])('$given', ({ given, ...expected }) => {
			const v = Range.parse(given)
			expect({ ...v }).to.eql(expected)
		})
	})
	describe('toString', () => {
		test.each<{
			given: ConstructorParameters<typeof Range>
			expected: string
		}>([
			// 0 1 2 3 ...
			//   |----
			{ given: [1, undefined], expected: '1-' },
			// 0 1 2 3
			// ^
			{ given: [0, 1], expected: '0-0' },
			// 0 1 2 3
			// |-|
			{ given: [0, 2], expected: '0-1' },
			// 0 1 2 3
			//   |-|
			{ given: [1, 2], expected: '1-2' },
			// 0 1 2 3
			//     ^
			{ given: [2, -1], expected: '2-2' },
			// 0 1 2 3
			//   |-|
			{ given: [2, -2], expected: '1-2' },
			//       1
			// 0 1 2 3
			// |     |
			{ given: [0, -2], expected: '-1,0-0' },
			// 0 1 2 3
			//     |--
			{ given: [-2, undefined], expected: '-2' },
			//         3 2 1
			// 0 1 2 3 4 5 6
			// ----|   |----
			{ given: [2, -6], expected: '-3,0-2' },
		])('new Range($given.0, $given.1).toString() => $expected', ({ given: [a, b], expected }) => {
			expect(new Range(a, b).toString()).to.be.eq(expected)
		})
	})
})
