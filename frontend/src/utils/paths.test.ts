import { expect, test } from 'vitest'
import { elementPath } from './paths'

test('encodes identifiers as one route segment', () => {
  expect(elementPath('a/b ?')).toBe('/elements/a%2Fb%20%3F')
  expect(elementPath('123', true)).toBe('/elements/123/edit')
})
