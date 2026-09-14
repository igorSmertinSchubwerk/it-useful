type AuthenticationListener = () => void

let csrfHeader: string | null = null
let csrfToken: string | null = null
const listeners = new Set<AuthenticationListener>()

export function setCsrfToken(headerName: string, token: string) {
  csrfHeader = headerName
  csrfToken = token
}

export function clearCsrfToken() {
  csrfHeader = null
  csrfToken = null
}

export function applyCsrfToken(headers: Headers) {
  if (csrfHeader && csrfToken) headers.set(csrfHeader, csrfToken)
}

export function notifyAuthenticationRequired() {
  clearCsrfToken()
  listeners.forEach((listener) => listener())
}

export function onAuthenticationRequired(listener: AuthenticationListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
