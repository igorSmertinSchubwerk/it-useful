import { Link, matchPath, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useRouteAccessibility } from '../hooks/useRouteAccessibility'
import { useI18n } from '../i18n/context'
import { LanguageMenu } from './LanguageSelector'
import { ThemeToggle } from './ThemeToggle'
import { useAuthentication, useCanEdit } from '../features/auth/context'
import { useState } from 'react'
import { definitionsPath } from '../utils/paths'
import { HeaderMenu, iconButtonClass } from './HeaderMenu'
import { AccountIcon, SettingsIcon } from './icons'

const linkClass =
  'text-brand underline-offset-4 hover:underline aria-[current=page]:font-bold aria-[current=page]:underline'

function SectionNavigation() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const { state } = useAuthentication()
  const canEdit = useCanEdit()
  if (state.status !== 'signedIn') return null
  const links = matchPath({ path: definitionsPath, end: false }, pathname)
    ? [
        { to: definitionsPath, label: t.allDefinitions, show: true },
        { to: `${definitionsPath}/new`, label: t.create, show: canEdit },
      ]
    : matchPath({ path: '/settings', end: false }, pathname)
      ? [
          { to: '/settings', label: t.general, show: true },
          {
            to: '/settings/accounts',
            label: t.accounts,
            show: state.role === 'ADMIN' && !state.local,
          },
          {
            to: '/settings/password',
            label: t.changePassword,
            show: !state.local,
          },
        ]
      : []
  if (links.length === 0) return null
  return (
    <nav
      aria-label={t.sectionNav}
      className="mx-auto flex max-w-5xl flex-wrap gap-5 border-t border-line px-6 py-3 text-sm"
    >
      {links
        .filter((link) => link.show)
        .map((link) => (
          <NavLink key={link.to} to={link.to} end className={linkClass}>
            {link.label}
          </NavLink>
        ))}
    </nav>
  )
}

export function AppLayout() {
  useRouteAccessibility()
  const { t } = useI18n()
  const { state, logout, loggingOut } = useAuthentication()
  const [logoutFailed, setLogoutFailed] = useState(false)
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-surface focus:p-3"
      >
        {t.skip}
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <NavLink to="/" className="text-xl font-bold text-ink">
              IT Useful
            </NavLink>
            {state.status === 'signedIn' && (
              <nav aria-label={t.nav} className="flex flex-wrap gap-5">
                <NavLink to="/" end className={linkClass}>
                  {t.dashboard}
                </NavLink>
                <NavLink to={definitionsPath} className={linkClass}>
                  {t.itDefinitions}
                </NavLink>
                <NavLink to="/settings" className={linkClass}>
                  {t.settings}
                </NavLink>
              </nav>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <ThemeToggle />
            <LanguageMenu />
            {state.status === 'signedIn' && (
              <>
                <Link
                  to="/settings"
                  aria-label={t.settings}
                  title={t.settings}
                  className={iconButtonClass}
                >
                  <SettingsIcon />
                </Link>
                <HeaderMenu label={t.account} icon={<AccountIcon />}>
                  {state.local ? (
                    <p>{t.localMode}</p>
                  ) : (
                    <>
                      <p className="text-muted">{t.signedInAs}</p>
                      <p className="font-semibold">{state.email}</p>
                      <button
                        type="button"
                        disabled={loggingOut}
                        className="mt-3 text-brand underline disabled:opacity-50"
                        onClick={() => {
                          setLogoutFailed(false)
                          void logout().catch(() => setLogoutFailed(true))
                        }}
                      >
                        {loggingOut ? t.loggingOut : t.logout}
                      </button>
                    </>
                  )}
                </HeaderMenu>
              </>
            )}
          </div>
        </div>
        <SectionNavigation />
        {logoutFailed && (
          <p
            role="alert"
            className="mx-auto max-w-5xl px-6 pb-4 text-sm text-red-800"
          >
            {t.logoutFailed}
          </p>
        )}
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-h-[70vh] max-w-5xl px-6 py-12 sm:py-16"
      >
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted">
        <span>{t.footer}</span>
        <NavLink to="/legal-notice" className="underline">
          {t.legalNotice}
        </NavLink>
        <NavLink to="/privacy" className="underline">
          {t.privacyPolicy}
        </NavLink>
      </footer>
    </>
  )
}
