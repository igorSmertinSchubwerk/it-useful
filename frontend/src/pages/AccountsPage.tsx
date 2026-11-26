import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import type {
  AccountRole,
  AccountSummary,
  CreatedInvitation,
} from '../api/accounts'
import { ApiError } from '../api/errors'
import {
  accountsApi as api,
  accountsKey,
  adminKey,
  invitationsKey,
} from '../features/accounts/queries'
import { useAuthentication } from '../features/auth/context'
import { useI18n } from '../i18n/context'

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
      void queryClient.invalidateQueries({ queryKey: adminKey })
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
          className="justify-self-start rounded bg-brand px-4 py-2 font-semibold text-on-brand hover:opacity-90 disabled:opacity-60"
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
          {created.emailSent && (
            <p role="status">
              {t.invitationEmailSent.replace('{email}', created.email)}
            </p>
          )}
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

type AccountAction = 'confirm' | 'makeAdmin' | 'makeUser' | 'disable' | 'enable'

function runAction(account: AccountSummary, action: AccountAction) {
  switch (action) {
    case 'confirm':
      return api.confirm(account.id)
    case 'makeAdmin':
      return api.changeRole(account.id, 'ADMIN')
    case 'makeUser':
      return api.changeRole(account.id, 'USER')
    case 'disable':
      return api.disable(account.id)
    case 'enable':
      return api.enable(account.id)
  }
}

type CreatedReset = { email: string; link: string; emailSent: boolean }

function AccountRow({
  account,
  onFailure,
  onReset,
}: {
  account: AccountSummary
  onFailure: (failure: unknown) => void
  onReset: (reset: CreatedReset) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const action = useMutation({
    mutationFn: (kind: AccountAction) => runAction(account, kind),
    onMutate: () => onFailure(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKey }),
    onError: onFailure,
  })
  const reset = useMutation({
    mutationFn: () => api.createPasswordReset(account.id),
    onMutate: () => onFailure(null),
    onSuccess: (created) =>
      onReset({
        email: account.email,
        link: created.link,
        emailSent: created.emailSent,
      }),
    onError: onFailure,
  })
  const busy = action.isPending || reset.isPending
  const statusLabel = {
    ACCEPTED: t.statusPending,
    CONFIRMED: t.statusConfirmed,
    DISABLED: t.statusDisabled,
  }[account.status]
  const button = (label: string, onClick: () => void) => (
    <button
      type="button"
      disabled={busy}
      aria-label={`${label} ${account.email}`}
      onClick={onClick}
      className="text-brand underline disabled:opacity-50"
    >
      {label}
    </button>
  )
  return (
    <tr className="border-t border-line">
      <td className="py-2 pr-4">{account.email}</td>
      <td className="py-2 pr-4">
        {account.role === 'ADMIN' ? t.roleAdmin : t.roleUser}
      </td>
      <td className="py-2 pr-4">{statusLabel}</td>
      <td className="flex flex-wrap gap-3 py-2">
        {account.status === 'ACCEPTED' &&
          button(t.confirm, () => action.mutate('confirm'))}
        {account.role === 'ADMIN'
          ? button(t.makeUser, () => action.mutate('makeUser'))
          : button(t.makeAdmin, () => action.mutate('makeAdmin'))}
        {account.status === 'DISABLED'
          ? button(t.enable, () => action.mutate('enable'))
          : button(t.disable, () => action.mutate('disable'))}
        {button(t.createResetLink, () => reset.mutate())}
      </td>
    </tr>
  )
}

function OpenInvitations() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const invitations = useQuery({
    queryKey: invitationsKey,
    queryFn: ({ signal }) => api.listInvitations(signal),
    retry: false,
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeInvitation(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: invitationsKey }),
  })
  const open = invitations.data ?? []
  return (
    <section className="overflow-x-auto rounded-xl border border-line bg-surface p-6">
      <h2 className="text-xl font-bold">{t.openInvitations}</h2>
      {invitations.isSuccess && open.length === 0 ? (
        <p className="mt-4 text-muted">{t.noOpenInvitations}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {open.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-3"
            >
              <span>{invitation.email}</span>
              <span className="text-muted">
                {invitation.role === 'ADMIN' ? t.roleAdmin : t.roleUser}
              </span>
              <button
                type="button"
                disabled={revoke.isPending}
                aria-label={`${t.revokeInvitationFor} ${invitation.email}`}
                onClick={() => revoke.mutate(invitation.id)}
                className="text-red-800 underline disabled:opacity-50"
              >
                {t.revoke}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AccountsPage() {
  const { t } = useI18n()
  const { state } = useAuthentication()
  const [failure, setFailure] = useState<string | null>(null)
  const [reset, setReset] = useState<CreatedReset | null>(null)
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

  function reportFailure(error: unknown) {
    setFailure(
      error === null
        ? null
        : error instanceof ApiError && error.code === 'last_admin'
          ? t.lastAdmin
          : t.authUnavailableText,
    )
  }

  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-bold">{t.accounts}</h1>
      <InviteForm />
      <OpenInvitations />
      <section className="overflow-x-auto rounded-xl border border-line bg-surface p-6">
        <h2 className="text-xl font-bold">{t.accountList}</h2>
        {failure && (
          <p role="alert" className="mt-4 text-red-800">
            {failure}
          </p>
        )}
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
                <AccountRow
                  key={account.id}
                  account={account}
                  onFailure={reportFailure}
                  onReset={setReset}
                />
              ))}
            </tbody>
          </table>
        )}
        {reset && (
          <div className="mt-6 grid gap-2">
            <label className="font-semibold">
              {t.passwordResetLink}
              <input readOnly value={reset.link} className={inputClass} />
            </label>
            {reset.emailSent && (
              <p role="status">
                {t.resetEmailSent.replace('{email}', reset.email)}
              </p>
            )}
            <p className="text-muted">
              {t.passwordResetLinkHint.replace('{email}', reset.email)}
            </p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(reset.link)}
              className="justify-self-start text-brand underline"
            >
              {t.copyResetLink}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
