export const definitionsPath = '/it-definitions'

export function elementPath(id: string, edit = false) {
  return `${definitionsPath}/${encodeURIComponent(id)}${edit ? '/edit' : ''}`
}
