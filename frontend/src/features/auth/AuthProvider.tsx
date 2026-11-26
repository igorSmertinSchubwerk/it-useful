import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../../api/errors'
import {
  clearCsrfToken,
  onAuthenticationRequired,
  setCsrfToken,
} from '../../api/authSession'
import { createSessionApi, type AccountSession } from '../../api/session'
import { AuthenticationContext, type AuthenticationState } from './context'

const api = createSessionApi()

function enabledByEnvironment() {
  const mode = import.meta.env.VITE_AUTHENTICATION ?? 'local'
  if (mode !== 'local' && mode !== 'server')
    throw new Error('VITE_AUTHENTICATION must be local or server')
  return mode === 'server'
}

export function AuthProvider({
  children,
  enabled = enabledByEnvironment(),
}: {
  children: ReactNode
  enabled?: boolean
}) {
  const queryClient = useQueryClient()
  const [attempt, setAttempt] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [state, setState] = useState<AuthenticationState>(
    enabled
      ? { status: 'loading' }
      : { status: 'signedIn', email: 'local', role: 'ADMIN', local: true },
  )

  useEffect(() => {
    if (!enabled) return
    return onAuthenticationRequired(() => {
      queryClient.clear()
      setState((current) =>
        current.status === 'signedIn'
          ? { status: 'expired' }
          : { status: 'anonymous' },
      )
    })
  }, [enabled, queryClient])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void api
      .get(controller.signal)
      .then((session: AccountSession) => {
        setCsrfToken(session.csrf.headerName, session.csrf.token)
        // Accepted and disabled accounts may hold a session but no access.
        if (session.status !== 'CONFIRMED') {
          queryClient.clear()
          setState(
            session.status === 'ACCEPTED'
              ? { status: 'pending', email: session.email }
              : { status: 'denied' },
          )
          return
        }
        setState({
          status: 'signedIn',
          email: session.email,
          role: session.role,
          local: false,
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        clearCsrfToken()
        queryClient.clear()
        if (error instanceof ApiError && error.status === 401)
          setState({ status: 'anonymous' })
        else if (error instanceof ApiError && error.status === 403)
          setState({ status: 'denied' })
        else setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [attempt, enabled, queryClient])

  const value = useMemo(
    () => ({
      state,
      loggingOut,
      retry: () => {
        setState({ status: 'loading' })
        setAttempt((current) => current + 1)
      },
      signIn: async (email: string, password: string, remember: boolean) => {
        const csrf = await api.csrf()
        setCsrfToken(csrf.headerName, csrf.token)
        await api.signIn(email, password, remember)
        setState({ status: 'loading' })
        setAttempt((current) => current + 1)
      },
      logout: async () => {
        if (
          !enabled ||
          (state.status !== 'signedIn' && state.status !== 'pending')
        )
          return
        setLoggingOut(true)
        try {
          await api.logout()
          clearCsrfToken()
          queryClient.clear()
          setState({ status: 'anonymous' })
        } finally {
          setLoggingOut(false)
        }
      },
    }),
    [enabled, loggingOut, queryClient, state],
  )

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  )
}
