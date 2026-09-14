import { Navigate, useLocation } from 'react-router-dom'
import { useAuthentication } from '../features/auth/context'
import { rememberReturnPath } from '../features/auth/returnPath'
import { useI18n } from '../i18n/context'

export function SignInPage() {
  const { state } = useAuthentication()
  const { t } = useI18n()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  if (state.status === 'owner') return <Navigate to="/" replace />
  return (
    <section className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold">{t.signIn}</h1>
      <p className="mt-4 text-muted">{t.signInText}</p>
      <a
        href="/oauth2/authorization/github"
        onClick={() => {
          if (typeof from === 'string') rememberReturnPath(from)
        }}
        className="mt-6 inline-block rounded bg-brand px-4 py-3 font-semibold text-white hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2"
      >
        {t.signInWithGitHub}
      </a>
    </section>
  )
}
