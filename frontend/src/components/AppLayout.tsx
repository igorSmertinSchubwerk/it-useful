import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useRouteAccessibility } from '../hooks/useRouteAccessibility'
import { useI18n } from '../i18n/context'
import { LanguageMenu } from './LanguageSelector'
import { ThemeToggle } from './ThemeToggle'
import { useAuthentication } from '../features/auth/context'
import { useState } from 'react'
import { definitionsPath } from '../utils/paths'
import { sectionOf } from '../utils/sections'
import { HeaderMenu, iconButtonClass } from './HeaderMenu'
import { AccountIcon, SettingsIcon } from './icons'

const dockLinkClass =
  'rounded-full px-4 py-2 font-semibold hover:bg-dock-ink/15 aria-[current=page]:bg-dock-active aria-[current=page]:text-dock-active-ink'

export function AppLayout() {
  useRouteAccessibility()
  const { t } = useI18n()
  const { pathname } = useLocation()
  const { state, logout, loggingOut } = useAuthentication()
  const [logoutFailed, setLogoutFailed] = useState(false)
  return (
    <div
      data-section={sectionOf(pathname)}
      className="min-h-screen bg-canvas text-ink"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-40 focus:rounded focus:bg-surface focus:p-3"
      >
        {t.skip}
      </a>
      <header className="relative z-30 px-3 pt-3 sm:sticky sm:top-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-3xl bg-dock p-2 text-dock-ink shadow-lg shadow-black/10 sm:rounded-full">
          <NavLink
            to="/"
            className="rounded-full px-3 py-2 text-lg font-extrabold tracking-tight"
          >
            IT Useful
          </NavLink>
          {state.status === 'signedIn' && (
            <nav aria-label={t.nav} className="flex flex-wrap gap-1">
              <NavLink to="/" end className={dockLinkClass}>
                {t.dashboard}
              </NavLink>
              <NavLink to={definitionsPath} className={dockLinkClass}>
                {t.itDefinitions}
              </NavLink>
            </nav>
          )}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            <ThemeToggle />
            <LanguageMenu />
            {state.status === 'signedIn' && (
              <>
                <NavLink
                  to="/settings"
                  aria-label={t.settings}
                  title={t.settings}
                  className={`${iconButtonClass} aria-[current=page]:bg-dock-active aria-[current=page]:text-dock-active-ink`}
                >
                  <SettingsIcon />
                </NavLink>
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
        {logoutFailed && (
          <p
            role="alert"
            className="mx-auto mt-2 max-w-5xl rounded-xl bg-surface px-4 py-2 text-sm text-red-800"
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
    </div>
  )
}
