import { expect, test } from 'vitest'
import { elementPath } from './paths'

test('encodes identifiers as one route segment', () => {
  expect(elementPath('a/b ?')).toBe('/it-definitions/a%2Fb%20%3F')
  expect(elementPath('123', true)).toBe('/it-definitions/123/edit')
})
