import { useState, type FormEvent } from 'react'
import { createAccountsApi } from '../api/accounts'
import { describePasswordFailure } from '../features/accounts/passwordFailure'
import { useI18n } from '../i18n/context'

const api = createAccountsApi()
const inputClass =
  'mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus:outline focus:outline-2 focus:outline-offset-2'

export function ChangePasswordPage() {
  const { t } = useI18n()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setChanged(false)
    if (password !== repeated) {
      setError(t.passwordsDoNotMatch)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.changeOwnPassword(current, password)
      setChanged(true)
    } catch (failure) {
      setError(describePasswordFailure(failure, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold">{t.changePassword}</h1>
      <form onSubmit={submit} className="mt-6 grid max-w-md gap-4">
        <label className="font-semibold">
          {t.currentPassword}
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className={inputClass}
          />
        </label>
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
        {changed && (
          <p role="status" className="rounded bg-canvas p-3">
            {t.passwordChanged}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="justify-self-start rounded bg-brand px-4 py-3 font-semibold text-on-brand hover:opacity-90 disabled:opacity-60"
        >
          {t.changePassword}
        </button>
      </form>
    </section>
  )
}
