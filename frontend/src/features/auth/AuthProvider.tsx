import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../../api/errors'
import {
  clearCsrfToken,
  onAuthenticationRequired,
  setCsrfToken,
} from '../../api/authSession'
import { createSessionApi, type OwnerSession } from '../../api/session'
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
      : { status: 'owner', login: 'local', local: true },
  )

  useEffect(() => {
    if (!enabled) return
    return onAuthenticationRequired(() => {
      queryClient.clear()
      setState((current) =>
        current.status === 'owner'
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
      .then((session: OwnerSession) => {
        setCsrfToken(session.csrf.headerName, session.csrf.token)
        setState({ status: 'owner', login: session.login, local: false })
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
      logout: async () => {
        if (!enabled || state.status !== 'owner') return
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
