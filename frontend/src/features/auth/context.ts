import { createContext, useContext } from 'react'

export type AuthenticationState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'denied' }
  | { status: 'pending'; email: string }
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
  signIn: (email: string, password: string, remember: boolean) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
  loggingOut: boolean
} | null>(null)

export function useAuthentication() {
  const context = useContext(AuthenticationContext)
  if (!context) throw new Error('useAuthentication requires an AuthProvider')
  return context
}

/**
 * Only admins may create, edit, or delete definitions. The backend enforces the
 * same rule, so this only hides controls that would be refused anyway.
 */
export function useCanEdit() {
  const { state } = useAuthentication()
  return state.status === 'signedIn' && state.role === 'ADMIN'
}
