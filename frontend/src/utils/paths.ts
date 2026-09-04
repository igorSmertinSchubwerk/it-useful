export function elementPath(id: string, edit = false) {
  return `/elements/${encodeURIComponent(id)}${edit ? '/edit' : ''}`
}
