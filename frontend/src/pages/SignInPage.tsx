import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ApiError } from '../api/errors'
import { useAuthentication } from '../features/auth/context'
import { rememberReturnPath } from '../features/auth/returnPath'
import { useI18n } from '../i18n/context'

const inputClass =
  'mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus:outline focus:outline-2 focus:outline-offset-2'

export function SignInPage() {
  const { state, signIn } = useAuthentication()
  const { t } = useI18n()
  const location = useLocation()
  const navigation = location.state as {
    from?: unknown
    notice?: unknown
  } | null
  const from = navigation?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  if (state.status === 'signedIn') return <Navigate to="/" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (typeof from === 'string') rememberReturnPath(from)
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email, password, remember)
    } catch (failure) {
      const status = failure instanceof ApiError ? failure.status : null
      setError(
        status === 401
          ? t.signInFailed
          : status === 429
            ? t.signInThrottled
            : t.authUnavailableText,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold">{t.signIn}</h1>
      <p className="mt-4 text-muted">{t.signInText}</p>
      {navigation?.notice === 'accountCreated' && (
        <p role="status" className="mt-4 rounded bg-canvas p-3">
          {t.accountCreatedNotice}
        </p>
      )}
      {navigation?.notice === 'passwordReset' && (
        <p role="status" className="mt-4 rounded bg-canvas p-3">
          {t.passwordResetNotice}
        </p>
      )}
      <form onSubmit={submit} className="mt-6 grid max-w-md gap-4">
        <label className="font-semibold">
          {t.emailAddress}
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="font-semibold">
          {t.password}
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="remember-me"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4"
          />
          {t.keepSignedIn}
        </label>
        {error && (
          <p role="alert" className="text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="justify-self-start rounded bg-brand px-4 py-3 font-semibold text-on-brand hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 disabled:opacity-60"
        >
          {submitting ? t.signingIn : t.signIn}
        </button>
      </form>
    </section>
  )
}
