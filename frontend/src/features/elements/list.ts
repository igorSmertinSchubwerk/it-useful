import type { ElementListItem, LanguageCode } from '../../api/contracts'

export const sortOptions = [
  'title-asc',
  'title-desc',
  'newest',
  'oldest',
] as const
export type ListSort = (typeof sortOptions)[number]
export function parseSort(value: string | null): ListSort {
  return sortOptions.find((option) => option === value) ?? 'title-asc'
}
export function parseContentLanguage(value: string | null): LanguageCode {
  return value === 'DE' || value === 'RU' ? value : 'EN'
}
export function selectElements(
  items: ElementListItem[],
  language: LanguageCode,
  search: string,
  sort: ListSort,
) {
  const locale = language.toLowerCase()
  const needle = search.trim().toLocaleLowerCase(locale)
  const collator = new Intl.Collator(locale, {
    sensitivity: 'base',
    numeric: true,
  })
  return items
    .filter((item) =>
      [item.titles[language] ?? '', item.slug].some((text) =>
        text.toLocaleLowerCase(locale).includes(needle),
      ),
    )
    .sort((a, b) => {
      let order: number
      if (sort === 'newest' || sort === 'oldest') {
        const aTime = Date.parse(a.updatedAt) || 0
        const bTime = Date.parse(b.updatedAt) || 0
        order = (aTime - bTime) * (sort === 'newest' ? -1 : 1)
      } else {
        const aTitle = a.titles[language]?.trim() || ''
        const bTitle = b.titles[language]?.trim() || ''
        // Keep missing translations last in either direction.
        order =
          !aTitle !== !bTitle
            ? aTitle
              ? -1
              : 1
            : collator.compare(aTitle, bTitle) *
              (sort === 'title-desc' ? -1 : 1)
      }
      return (
        order || collator.compare(a.slug, b.slug) || a.id.localeCompare(b.id)
      )
    })
}
