import { expect, test } from 'vitest'
import { formatCount } from './counts'

const forms = {
  one: 'one {count}',
  few: 'few {count}',
  many: 'many {count}',
  other: 'other {count}',
}

test.each([
  ['ru', 1, 'one 1'],
  ['ru', 21, 'one 21'],
  ['ru', 2, 'few 2'],
  ['ru', 24, 'few 24'],
  ['ru', 5, 'many 5'],
  ['ru', 11, 'many 11'],
  ['ru', 0, 'many 0'],
  ['de', 1, 'one 1'],
  ['de', 2, 'other 2'],
  ['en', 0, 'other 0'],
  ['en', 5, 'other 5'],
] as const)(
  'formatCount in %s picks the form for %i',
  (language, count, expected) => {
    expect(formatCount(language, count, forms)).toBe(expected)
  },
)
