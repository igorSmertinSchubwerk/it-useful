import type { UiLanguage } from '../../i18n/messages'

export type CountForms = {
  one: string
  few: string
  many: string
  other: string
}

export function formatCount(
  language: UiLanguage,
  count: number,
  forms: CountForms,
) {
  const category = new Intl.PluralRules(language).select(count)
  const form =
    category === 'one' || category === 'few' || category === 'many'
      ? category
      : 'other'
  return forms[form].replace('{count}', String(count))
}
