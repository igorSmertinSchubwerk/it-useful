import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuthentication } from './context'
import { useI18n } from '../../i18n/context'
import { takeReturnPath } from './returnPath'

export function AuthenticationGate() {
  const { state, retry } = useAuthentication()
  const { t } = useI18n()
  const location = useLocation()
  const [returnPath] = useState(takeReturnPath)
  if (state.status === 'owner') {
    if (
      !state.local &&
      returnPath &&
      returnPath !== `${location.pathname}${location.search}`
    )
      return <Navigate to={returnPath} replace />
    return <Outlet />
  }
  if (state.status === 'anonymous')
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  if (state.status === 'loading') return <p role="status">{t.authLoading}</p>
  return (
    <section className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold">
        {state.status === 'denied'
          ? t.accessDenied
          : state.status === 'expired'
            ? t.sessionExpired
            : t.authUnavailable}
      </h1>
      <p role="alert" className="mt-4 text-muted">
        {state.status === 'denied'
          ? t.accessDeniedText
          : state.status === 'expired'
            ? t.sessionExpiredText
            : t.authUnavailableText}
      </p>
      {state.status === 'error' ? (
        <button
          type="button"
          onClick={retry}
          className="mt-6 text-brand underline"
        >
          {t.retry}
        </button>
      ) : (
        <a
          href="/oauth2/authorization/github"
          className="mt-6 inline-block text-brand underline"
        >
          {t.signInAgain}
        </a>
      )}
    </section>
  )
}
