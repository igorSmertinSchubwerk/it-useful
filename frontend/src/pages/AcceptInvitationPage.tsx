import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createAccountsApi } from '../api/accounts'
import { setCsrfToken } from '../api/authSession'
import { ApiError } from '../api/errors'
import { createSessionApi } from '../api/session'
import { useI18n } from '../i18n/context'

const accountsApi = createAccountsApi()
const sessionApi = createSessionApi()
const inputClass =
  'mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus:outline focus:outline-2 focus:outline-offset-2'

export function AcceptInvitationPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  // The token travels in the fragment, so no server or proxy ever receives it.
  const token = useLocation().hash.replace(/^#/, '')
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function describe(failure: unknown) {
    if (!(failure instanceof ApiError)) return t.authUnavailableText
    if (failure.code === 'invitation_invalid') return t.invitationInvalid
    if (failure.code === 'password_rejected')
      return (
        {
          TOO_SHORT: t.passwordTooShort,
          TOO_LONG: t.passwordTooLong,
          MATCHES_EMAIL: t.passwordMatchesEmail,
          TOO_COMMON: t.passwordTooCommon,
        }[failure.violation ?? ''] ?? t.passwordTooCommon
      )
    return t.authUnavailableText
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== repeated) {
      setError(t.passwordsDoNotMatch)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const csrf = await sessionApi.csrf()
      setCsrfToken(csrf.headerName, csrf.token)
      await accountsApi.acceptInvitation(token, password)
      navigate('/sign-in', {
        replace: true,
        state: { notice: 'accountCreated' },
      })
    } catch (failure) {
      setError(describe(failure))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold">{t.acceptInvitation}</h1>
      {token ? (
        <>
          <p className="mt-4 text-muted">{t.acceptInvitationText}</p>
          <form onSubmit={submit} className="mt-6 grid max-w-md gap-4">
            <label className="font-semibold">
              {t.newPassword}
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="font-semibold">
              {t.repeatPassword}
              <input
                type="password"
                autoComplete="new-password"
                required
                value={repeated}
                onChange={(event) => setRepeated(event.target.value)}
                className={inputClass}
              />
            </label>
            {error && (
              <p role="alert" className="text-red-800">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="justify-self-start rounded bg-brand px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? t.creatingAccount : t.createAccount}
            </button>
          </form>
        </>
      ) : (
        <p role="alert" className="mt-4 text-red-800">
          {t.invitationInvalid}
        </p>
      )}
    </section>
  )
}
