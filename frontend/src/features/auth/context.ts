import { createContext, useContext } from 'react'

export type AuthenticationState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'denied' }
  | { status: 'expired' }
  | { status: 'owner'; login: string; local: boolean }
  | { status: 'error' }

export const AuthenticationContext = createContext<{
  state: AuthenticationState
  logout: () => Promise<void>
  retry: () => void
  loggingOut: boolean
} | null>(null)

export function useAuthentication() {
  const context = useContext(AuthenticationContext)
  if (!context) throw new Error('useAuthentication requires an AuthProvider')
  return context
}
