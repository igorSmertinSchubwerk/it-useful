import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  createAccountsApi,
  type AccountRole,
  type AccountSummary,
  type CreatedInvitation,
} from '../api/accounts'
import { ApiError } from '../api/errors'
import { useAuthentication } from '../features/auth/context'
import { useI18n } from '../i18n/context'

const api = createAccountsApi()
const accountsKey = ['admin', 'accounts'] as const
const inputClass =
  'mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus:outline focus:outline-2 focus:outline-offset-2'

function InviteForm() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccountRole>('USER')
  const [created, setCreated] = useState<CreatedInvitation | null>(null)
  const invite = useMutation({
    mutationFn: () => api.invite(email, role),
    onSuccess: (invitation) => {
      setCreated(invitation)
      void queryClient.invalidateQueries({ queryKey: accountsKey })
    },
  })
  const failure = invite.error
  const message =
    failure instanceof ApiError && failure.code === 'account_exists'
      ? t.accountExists
      : failure instanceof ApiError && failure.status === 400
        ? t.invitationRequestInvalid
        : failure
          ? t.authUnavailableText
          : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    invite.mutate()
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-xl font-bold">{t.inviteSomeone}</h2>
      <form onSubmit={submit} className="mt-4 grid max-w-md gap-4">
        <label className="font-semibold">
          {t.emailAddress}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="font-semibold">
          {t.role}
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AccountRole)}
            className={inputClass}
          >
            <option value="USER">{t.roleUser}</option>
            <option value="ADMIN">{t.roleAdmin}</option>
          </select>
        </label>
        {message && (
          <p role="alert" className="text-red-800">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={invite.isPending}
          className="justify-self-start rounded bg-brand px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {t.createInvitation}
        </button>
      </form>
      {created && (
        <div className="mt-6 grid gap-2">
          <label className="font-semibold">
            {t.invitationLink}
            <input readOnly value={created.link} className={inputClass} />
          </label>
          <p className="text-muted">{t.invitationLinkHint}</p>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(created.link)}
            className="justify-self-start text-brand underline"
          >
            {t.copyLink}
          </button>
        </div>
      )}
    </section>
  )
}

function AccountRow({ account }: { account: AccountSummary }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const confirm = useMutation({
    mutationFn: () => api.confirm(account.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsKey }),
  })
  const statusLabel = {
    ACCEPTED: t.statusPending,
    CONFIRMED: t.statusConfirmed,
    DISABLED: t.statusDisabled,
  }[account.status]
  return (
    <tr className="border-t border-line">
      <td className="py-2 pr-4">{account.email}</td>
      <td className="py-2 pr-4">
        {account.role === 'ADMIN' ? t.roleAdmin : t.roleUser}
      </td>
      <td className="py-2 pr-4">{statusLabel}</td>
      <td className="py-2">
        {account.status === 'ACCEPTED' && (
          <button
            type="button"
            disabled={confirm.isPending}
            aria-label={`${t.confirm} ${account.email}`}
            onClick={() => confirm.mutate()}
            className="text-brand underline disabled:opacity-50"
          >
            {t.confirm}
          </button>
        )}
      </td>
    </tr>
  )
}

export function AccountsPage() {
  const { t } = useI18n()
  const { state } = useAuthentication()
  const isAdmin = state.status === 'signedIn' && state.role === 'ADMIN'
  const accounts = useQuery({
    queryKey: accountsKey,
    queryFn: ({ signal }) => api.list(signal),
    enabled: isAdmin,
    retry: false,
  })
  if (!isAdmin)
    return (
      <p role="alert" className="text-red-800">
        {t.adminsOnly}
      </p>
    )
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-bold">{t.accounts}</h1>
      <InviteForm />
      <section className="overflow-x-auto rounded-xl border border-line bg-surface p-6">
        <h2 className="text-xl font-bold">{t.accountList}</h2>
        {accounts.isError ? (
          <p role="alert" className="mt-4 text-red-800">
            {t.authUnavailableText}
          </p>
        ) : (
          <table className="mt-4 w-full text-left">
            <thead>
              <tr>
                <th className="pb-2 pr-4">{t.emailAddress}</th>
                <th className="pb-2 pr-4">{t.role}</th>
                <th className="pb-2 pr-4">{t.status}</th>
                <th className="pb-2">
                  <span className="sr-only">{t.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(accounts.data ?? []).map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
