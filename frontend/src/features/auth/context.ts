import { createContext, useContext } from 'react'

export type AuthenticationState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'denied' }
  | { status: 'expired' }
  | {
      status: 'signedIn'
      email: string
      role: 'USER' | 'ADMIN'
      local: boolean
    }
  | { status: 'error' }

export const AuthenticationContext = createContext<{
  state: AuthenticationState
  signIn: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
  loggingOut: boolean
} | null>(null)

export function useAuthentication() {
  const context = useContext(AuthenticationContext)
  if (!context) throw new Error('useAuthentication requires an AuthProvider')
  return context
}
