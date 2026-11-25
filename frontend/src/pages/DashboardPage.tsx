import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LanguageCode } from '../api/contracts'
import {
  accountsApi,
  accountsKey,
  invitationsKey,
} from '../features/accounts/queries'
import { useAuthentication } from '../features/auth/context'
import { formatCount } from '../features/dashboard/counts'
import { selectElements } from '../features/elements/list'
import { useElements } from '../features/elements/queries'
import { useI18n } from '../i18n/context'
import { localizeApiError } from '../i18n/errors'
import { elementPath } from '../utils/paths'

const languageNames = { en: 'English', de: 'Deutsch', ru: 'Русский' }

function DashboardCard({
  id,
  title,
  linkLabel,
  to,
  children,
}: {
  id: string
  title: string
  linkLabel: string
  to: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col rounded-xl border border-line bg-surface p-6 sm:p-8"
    >
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      <div className="mt-4 grid flex-1 content-start gap-3">{children}</div>
      <Link to={to} className="mt-6 font-semibold text-brand underline">
        {linkLabel}
      </Link>
    </section>
  )
}

function DefinitionsCard() {
  const { t, language } = useI18n()
  const query = useElements()
  // Same default as the definition list: content language is independent of the interface language.
  const contentLanguage: LanguageCode = 'EN'
  const latest = selectElements(
    query.data ?? [],
    contentLanguage,
    '',
    'newest',
  ).slice(0, 3)
  return (
    <DashboardCard
      id="dashboard-definitions"
      title={t.itDefinitions}
      linkLabel={t.openItDefinitions}
      to="/elements"
    >
      {query.isPending && <p role="status">{t.loading}</p>}
      {query.isError && (
        <p role="alert" className="text-red-800">
          {localizeApiError(query.error, language).message}
        </p>
      )}
      {query.data && (
        <>
          <p className="text-4xl font-bold">
            {formatCount(language, query.data.length, {
              one: t.definitionsOne,
              few: t.definitionsFew,
              many: t.definitionsMany,
              other: t.definitionsOther,
            })}
          </p>
          {latest.length === 0 ? (
            <p className="text-muted">{t.empty}</p>
          ) : (
            <>
              <h3 className="font-semibold">{t.recentlyChanged}</h3>
              <ul className="grid gap-1">
                {latest.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={elementPath(item.id)}
                      className="text-brand underline"
                    >
                      {item.titles[contentLanguage]?.trim() || item.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </DashboardCard>
  )
}

function AdministrationFigures() {
  const { t, language } = useI18n()
  const accounts = useQuery({
    queryKey: accountsKey,
    queryFn: ({ signal }) => accountsApi.list(signal),
    retry: false,
  })
  const invitations = useQuery({
    queryKey: invitationsKey,
    queryFn: ({ signal }) => accountsApi.listInvitations(signal),
    retry: false,
  })
  if (accounts.isError || invitations.isError)
    return (
      <p role="alert" className="text-red-800">
        {t.authUnavailableText}
      </p>
    )
  const pending = accounts.data?.filter(
    (account) => account.status === 'ACCEPTED',
  ).length
  return (
    <>
      {pending !== undefined && (
        <p>
          {formatCount(language, pending, {
            one: t.pendingAccountsOne,
            few: t.pendingAccountsFew,
            many: t.pendingAccountsMany,
            other: t.pendingAccountsOther,
          })}
        </p>
      )}
      {invitations.data && (
        <p>
          {formatCount(language, invitations.data.length, {
            one: t.openInvitationsOne,
            few: t.openInvitationsFew,
            many: t.openInvitationsMany,
            other: t.openInvitationsOther,
          })}
        </p>
      )}
    </>
  )
}

function SettingsCard() {
  const { t, language } = useI18n()
  const { state } = useAuthentication()
  if (state.status !== 'signedIn') return null
  return (
    <DashboardCard
      id="dashboard-settings"
      title={t.settings}
      linkLabel={t.openSettings}
      to="/settings"
    >
      <dl className="grid gap-1">
        <dt className="text-sm text-muted">{t.uiLanguage}</dt>
        <dd className="font-semibold">{languageNames[language]}</dd>
        <dt className="mt-2 text-sm text-muted">{t.account}</dt>
        <dd className="font-semibold">
          {state.local ? t.localMode : state.email}
        </dd>
      </dl>
      {state.role === 'ADMIN' && !state.local && <AdministrationFigures />}
    </DashboardCard>
  )
}

export function DashboardPage() {
  const { t } = useI18n()
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {t.dashboard}
      </h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <DefinitionsCard />
        <SettingsCard />
      </div>
    </>
  )
}
