import { expect, test } from 'vitest'
import { parseDefinitionFile } from './importFile'

const all = {
  EN: { title: 'API', content: 'An **interface**.', examples: 'GET /users' },
  DE: {
    title: 'API (DE)',
    content: 'Eine Schnittstelle.',
    examples: 'GET /nutzer',
  },
  RU: { title: 'АПИ', content: 'Интерфейс.', examples: 'GET /users' },
}

test('parseDefinitionFile reads all three languages from JSON', () => {
  const json = JSON.stringify({
    en: {
      title: 'API',
      explanation: 'An **interface**.',
      examples: 'GET /users',
    },
    de: {
      title: 'API (DE)',
      explanation: 'Eine Schnittstelle.',
      examples: 'GET /nutzer',
    },
    ru: { title: 'АПИ', explanation: 'Интерфейс.', examples: 'GET /users' },
  })
  expect(parseDefinitionFile('api.json', json)).toEqual(all)
})

test('parseDefinitionFile reads all three languages from XML', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definition>
  <en><title>API</title><explanation>An **interface**.</explanation><examples>GET /users</examples></en>
  <de><title>API (DE)</title><explanation>Eine Schnittstelle.</explanation><examples>GET /nutzer</examples></de>
  <ru><title>АПИ</title><explanation>Интерфейс.</explanation><examples>GET /users</examples></ru>
</definition>`
  expect(parseDefinitionFile('API.XML', xml)).toEqual(all)
})

test.each(['api.txt', 'api.md'])(
  'parseDefinitionFile reads key lines from %s and keeps inner blank lines',
  (name) => {
    const text = `[en.title]
API

[en.explanation]
First paragraph.

- item

[en.examples]
GET /users
[ru.title]
АПИ
`
    expect(parseDefinitionFile(name, text)).toEqual({
      EN: {
        title: 'API',
        content: 'First paragraph.\n\n- item',
        examples: 'GET /users',
      },
      RU: { title: 'АПИ' },
    })
  },
)

test('parseDefinitionFile keeps only known keys and string values', () => {
  const json = JSON.stringify({
    en: { title: 'API', slug: 'x', examples: 5 },
    fr: { title: 'API' },
  })
  expect(parseDefinitionFile('api.json', json)).toEqual({
    EN: { title: 'API' },
  })
})

test.each([
  ['broken.json', '{"en": '],
  ['list.json', '[1, 2]'],
  ['broken.xml', '<definition><en><title>API</en>'],
  ['empty.txt', 'no keys in here'],
  ['unknown.csv', '[en.title]\nAPI'],
  ['none.json', '{"fr": {"title": "API"}}'],
])('parseDefinitionFile rejects %s', (name, text) => {
  expect(parseDefinitionFile(name, text)).toBeUndefined()
})
