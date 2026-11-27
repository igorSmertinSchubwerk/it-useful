import type { ElementDetail, ElementListItem } from '../../api/contracts'
import { languages, toWriteRequest } from '../../schemas/elementSchema'
import type { ElementFormValues } from '../../schemas/elementSchema'

const normalized = (title: string) => title.trim().toLocaleLowerCase()

/**
 * The indexes of the languages whose title another definition already uses.
 * English also counts as taken when its slug is, because slugs are unique.
 */
export function duplicateTitles(
  values: ElementFormValues,
  items: ElementListItem[],
  element?: ElementDetail,
): number[] {
  const others = items.filter((item) => item.id !== element?.id)
  const slug = toWriteRequest(values, element).slug
  return languages.flatMap((code, index) => {
    const title = normalized(values.translations[index].title)
    if (!title) return []
    const taken = others.some(
      (item) =>
        normalized(item.titles[code] ?? '') === title ||
        (index === 0 && item.slug === slug),
    )
    return taken ? [index] : []
  })
}
