import { expect, test } from 'vitest'
import { elementSchema, initialValues, serverField } from './elementSchema'
import { elementFixture } from '../test/elementFixture'

test('accepts complete translations and preserves Markdown whitespace', () => {
  const values = initialValues(elementFixture)
  values.translations[0].content = '  code\n\n'
  expect(elementSchema.parse(values)).toEqual(values)
})
test.each(['', 'a--b', '-a', 'a-', 'has space', 'слово', 'x'.repeat(161)])(
  'rejects invalid slug %s',
  (slug) => {
    expect(
      elementSchema.safeParse({ ...initialValues(elementFixture), slug })
        .success,
    ).toBe(false)
  },
)
test('accepts uppercase and exact boundary lengths matching the backend', () => {
  const values = initialValues(elementFixture)
  values.slug = 'X'.repeat(160)
  values.translations[0] = {
    languageCode: 'EN',
    title: 't'.repeat(255),
    content: 'c'.repeat(50_000),
    examples: 'e'.repeat(50_000),
  }
  expect(elementSchema.safeParse(values).success).toBe(true)
})
test.each(['title', 'content', 'examples'] as const)(
  'rejects too-long %s with the correct field path',
  (field) => {
    const values = initialValues(elementFixture)
    values.translations[1][field] = 'x'.repeat(field === 'title' ? 256 : 50_001)
    const result = elementSchema.safeParse(values)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues[0].path).toEqual(['translations', 1, field])
  },
)
test.each(['', ' \t\n', '\u001c', '\u2003'])(
  'rejects Java-blank required content %j',
  (content) => {
    const values = initialValues(elementFixture)
    values.translations[2].content = content
    expect(elementSchema.safeParse(values).success).toBe(false)
  },
)
test('matches Java nonbreaking-space semantics and UTF-16 title length', () => {
  const values = initialValues(elementFixture)
  values.translations[0].title = '\u00a0'
  expect(elementSchema.safeParse(values).success).toBe(true)
  values.translations[0].title = '😀'.repeat(128)
  expect(elementSchema.safeParse(values).success).toBe(false)
})
test('requires exactly EN/DE/RU in canonical submission order', () => {
  const values = initialValues(elementFixture)
  expect(
    elementSchema.safeParse({
      ...values,
      translations: values.translations.slice(0, 2),
    }).success,
  ).toBe(false)
  expect(
    elementSchema.safeParse({
      ...values,
      translations: [
        values.translations[0],
        values.translations[0],
        values.translations[2],
      ],
    }).success,
  ).toBe(false)
})
test('maps incomplete/reordered data by language, normalizes null examples, and excludes images', () => {
  const values = initialValues({
    ...elementFixture,
    translations: [elementFixture.translations[2]],
  })
  expect(values.translations[0].title).toBe('')
  expect(values.translations[2].title).toBe('HTTP по-русски')
  expect(initialValues(elementFixture).translations[1].examples).toBe('')
  expect(values).not.toHaveProperty('images')
})
test('only accepts known server field paths', () => {
  expect(serverField('slug')).toBe('slug')
  expect(serverField('translations[2].content')).toBe('translations.2.content')
  for (const field of [
    '__proto__',
    'translations[3].title',
    'translations',
    'translations[0].languageCode',
    'images[0].altText',
  ])
    expect(serverField(field)).toBeUndefined()
})
