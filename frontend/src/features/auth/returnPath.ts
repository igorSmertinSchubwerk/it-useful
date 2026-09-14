const storageKey = 'it-useful.auth-return'

function safePath(path: string) {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    ![...path].some((character) => character.charCodeAt(0) < 32) &&
    !path.startsWith('/sign-in')
  )
}

export function rememberReturnPath(path: string) {
  if (!safePath(path)) return
  try {
    sessionStorage.setItem(storageKey, path)
  } catch {
    // Storage can be disabled. Falling back to the start page is safe.
  }
}

export function takeReturnPath() {
  try {
    const path = sessionStorage.getItem(storageKey)
    sessionStorage.removeItem(storageKey)
    return path && safePath(path) ? path : null
  } catch {
    return null
  }
}
