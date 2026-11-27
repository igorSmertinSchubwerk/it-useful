import { z } from 'zod'
import type {
  ElementDetail,
  ElementWriteRequest,
  LanguageCode,
} from '../api/contracts'

export const languages = ['EN', 'DE', 'RU'] as const
// Match Java Character.isWhitespace used by @NotBlank, including UTF-16 lengths.
const nonBlank =
  // eslint-disable-next-line no-control-regex -- Java whitespace includes these controls.
  /[^\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/u
const fields = {
  title: z
    .string()
    .refine((value) => value.length <= 255, 'titleLimit')
    .regex(nonBlank, 'requiredField'),
  content: z
    .string()
    .refine((value) => value.length <= 50_000, 'textLimit')
    .regex(nonBlank, 'requiredField'),
  examples: z.string().refine((value) => value.length <= 50_000, 'textLimit'),
}
const germanLetters: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
}

/** The URL-safe identifier the backend stores, at most 160 characters. */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöüß]/g, (letter) => germanLetters[letter])
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 160)
    .replace(/^-|-$/g, '')
}

export const elementSchema = z.object({
  translations: z.tuple([
    z.object({
      languageCode: z.literal('EN'),
      ...fields,
      // The slug comes from this title, so it needs something a slug can hold.
      title: fields.title.refine(
        (value) => slugFromTitle(value) !== '',
        'titleSlugRule',
      ),
    }),
    z.object({ languageCode: z.literal('DE'), ...fields }),
    z.object({ languageCode: z.literal('RU'), ...fields }),
  ]),
})
export type ElementFormValues = z.infer<typeof elementSchema>
export type EditableField =
  `translations.${0 | 1 | 2}.${'title' | 'content' | 'examples'}`

export function initialValues(element?: ElementDetail): ElementFormValues {
  function translation<L extends LanguageCode>(languageCode: L) {
    const saved = element?.translations.find(
      (item) => item.languageCode === languageCode,
    )
    return {
      languageCode,
      title: saved?.title ?? '',
      content: saved?.content ?? '',
      examples: saved?.examples ?? '',
    }
  }
  return {
    translations: [translation('EN'), translation('DE'), translation('RU')],
  }
}

export function serverField(field: string): EditableField | undefined {
  if (field === 'slug') return 'translations.0.title'
  const match = /^translations\[([012])\]\.(title|content|examples)$/.exec(
    field,
  )
  return match
    ? (`translations.${match[1]}.${match[2]}` as EditableField)
    : undefined
}

/** A saved definition keeps its slug until its English title changes. */
export function toWriteRequest(
  values: ElementFormValues,
  element?: ElementDetail,
): ElementWriteRequest {
  const title = values.translations[0].title
  const unchanged =
    element && initialValues(element).translations[0].title === title
  return {
    slug: unchanged ? element.slug : slugFromTitle(title),
    translations: values.translations,
  }
}
