import type { LanguageCode } from '../../api/contracts'
import { languages } from '../../schemas/elementSchema'

type Field = 'title' | 'content' | 'examples'
export type ImportedDefinition = Partial<
  Record<LanguageCode, Partial<Record<Field, string>>>
>
// The file says "explanation", as the form does. The API calls it "content".
const fileKeys = {
  title: 'title',
  explanation: 'content',
  examples: 'examples',
}
type FileKey = keyof typeof fileKeys
type Entry = [language: string, key: string, value: unknown]

function fromJson(text: string): Entry[] {
  const data: unknown = JSON.parse(text)
  if (typeof data !== 'object' || data === null) return []
  return Object.entries(data).flatMap(([language, fields]) =>
    typeof fields === 'object' && fields !== null
      ? Object.entries(fields).map(([key, value]): Entry => [
          language,
          key,
          value,
        ])
      : [],
  )
}

function fromXml(text: string): Entry[] {
  const root = new DOMParser().parseFromString(text, 'application/xml')
  if (root.querySelector('parsererror')) return []
  return [...root.documentElement.children].flatMap((language) =>
    [...language.children].map((field): Entry => [
      language.tagName,
      field.tagName,
      field.textContent.trim(),
    ]),
  )
}

function fromKeyLines(text: string): Entry[] {
  const parts = text.split(/^\[(\w+)\.(\w+)\][ \t]*$/m)
  const entries: Entry[] = []
  for (let index = 1; index < parts.length; index += 3)
    entries.push([parts[index], parts[index + 1], parts[index + 2].trim()])
  return entries
}

const readers: Record<string, (text: string) => Entry[]> = {
  json: fromJson,
  xml: fromXml,
  txt: fromKeyLines,
  md: fromKeyLines,
}

/**
 * Reads a definition from an uploaded file.
 * Returns nothing when the file type is unknown, the file is malformed,
 * or it holds none of the documented keys.
 */
export function parseDefinitionFile(
  name: string,
  text: string,
): ImportedDefinition | undefined {
  const read = readers[name.split('.').pop()!.toLowerCase()]
  if (!read) return
  let entries: Entry[]
  try {
    entries = read(text)
  } catch {
    return
  }
  const result: ImportedDefinition = {}
  for (const [language, key, value] of entries) {
    const code = languages.find((item) => item === language.toUpperCase())
    if (!code || !Object.hasOwn(fileKeys, key) || typeof value !== 'string')
      continue
    result[code] = { ...result[code], [fileKeys[key as FileKey]]: value }
  }
  return Object.keys(result).length ? result : undefined
}
