import { expect, test } from 'vitest'
import { parseContentLanguage, parseSort, selectElements } from './list'
import type { ElementListItem } from '../../api/contracts'

const items: ElementListItem[] = [
  {
    id: 'b',
    slug: 'beta',
    titles: { EN: 'Beta', DE: 'Alpha', RU: 'Бета' },
    updatedAt: '2026-09-02T00:00:00Z',
  },
  {
    id: 'a',
    slug: 'alpha',
    titles: { EN: 'Alpha', DE: 'Beta', RU: 'Альфа' },
    updatedAt: '2026-09-01T00:00:00Z',
  },
  { id: 'c', slug: 'missing', titles: {}, updatedAt: '2026-09-03T00:00:00Z' },
]
test('filters selected language titles or slugs case-insensitively without changing source data', () => {
  expect(
    selectElements(items, 'RU', ' АЛЬ ', 'title-asc').map((i) => i.id),
  ).toEqual(['a'])
  expect(
    selectElements(items, 'EN', 'miss', 'title-asc').map((i) => i.id),
  ).toEqual(['c'])
  expect(items.map((i) => i.id)).toEqual(['b', 'a', 'c'])
})
test.each([
  ['title-asc', ['a', 'b', 'c']],
  ['title-desc', ['b', 'a', 'c']],
  ['newest', ['c', 'b', 'a']],
  ['oldest', ['a', 'b', 'c']],
] as const)('sorts by %s', (sort, ids) => {
  expect(selectElements(items, 'EN', '', sort).map((i) => i.id)).toEqual(ids)
})
test('sorts localized titles and normalizes invalid URL options', () => {
  expect(selectElements(items, 'DE', '', 'title-asc').map((i) => i.id)).toEqual(
    ['b', 'a', 'c'],
  )
  expect(parseContentLanguage('bad')).toBe('EN')
  expect(parseContentLanguage('RU')).toBe('RU')
  expect(parseSort('bad')).toBe('title-asc')
})
