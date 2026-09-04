import { z } from 'zod'
import type { ElementDetail, LanguageCode } from '../api/contracts'

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
export const elementSchema = z.object({
  slug: z
    .string()
    .max(160, 'slugLimit')
    .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, 'slugRule'),
  translations: z.tuple([
    z.object({ languageCode: z.literal('EN'), ...fields }),
    z.object({ languageCode: z.literal('DE'), ...fields }),
    z.object({ languageCode: z.literal('RU'), ...fields }),
  ]),
})
export type ElementFormValues = z.infer<typeof elementSchema>
export type EditableField =
  'slug' | `translations.${0 | 1 | 2}.${'title' | 'content' | 'examples'}`

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
    slug: element?.slug ?? '',
    translations: [translation('EN'), translation('DE'), translation('RU')],
  }
}

export function serverField(field: string): EditableField | undefined {
  if (field === 'slug') return field
  const match = /^translations\[([012])\]\.(title|content|examples)$/.exec(
    field,
  )
  return match
    ? (`translations.${match[1]}.${match[2]}` as EditableField)
    : undefined
}
