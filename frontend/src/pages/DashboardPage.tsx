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
import { definitionsPath, elementPath } from '../utils/paths'

const languageNames = { en: 'English', de: 'Deutsch', ru: 'Русский' }

const tileColors = {
  first: 'bg-tile-1',
  second: 'bg-tile-2',
}

const alertChip =
  'justify-self-start rounded-xl bg-surface px-3 py-2 text-red-800'

function DashboardCard({
  id,
  title,
  linkLabel,
  to,
  tone,
  children,
}: {
  id: string
  title: string
  linkLabel: string
  to: string
  tone: keyof typeof tileColors
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      data-tile
      className={`flex flex-col rounded-[28px] p-7 text-tile-ink sm:p-8 ${tileColors[tone]}`}
    >
      <h2 id={id} className="text-2xl font-extrabold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 grid flex-1 content-start gap-3">{children}</div>
      <Link to={to} className="mt-6 font-bold underline underline-offset-4">
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
      to={definitionsPath}
      tone="first"
    >
      {query.isPending && <p role="status">{t.loading}</p>}
      {query.isError && (
        <p role="alert" className={alertChip}>
          {localizeApiError(query.error, language).message}
        </p>
      )}
      {query.data && (
        <>
          <p className="text-5xl font-extrabold tracking-tight">
            {formatCount(language, query.data.length, {
              one: t.definitionsOne,
              few: t.definitionsFew,
              many: t.definitionsMany,
              other: t.definitionsOther,
            })}
          </p>
          {latest.length === 0 ? (
            <p>{t.empty}</p>
          ) : (
            <>
              <h3 className="font-semibold">{t.recentlyChanged}</h3>
              <ul className="flex flex-wrap gap-2">
                {latest.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={elementPath(item.id)}
                      className="inline-block rounded-full bg-white px-4 py-1.5 font-semibold text-tile-ink hover:underline"
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
      <p role="alert" className={alertChip}>
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
      tone="second"
    >
      <dl className="grid gap-1">
        <dt className="text-sm">{t.uiLanguage}</dt>
        <dd className="font-semibold">{languageNames[language]}</dd>
        <dt className="mt-2 text-sm">{t.account}</dt>
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
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
        {t.dashboard}
      </h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <DefinitionsCard />
        <SettingsCard />
      </div>
    </>
  )
}
