import { NavLink, Outlet } from 'react-router-dom'
import { useRouteAccessibility } from '../hooks/useRouteAccessibility'
import { useI18n } from '../i18n/context'
import { LanguageSelector } from './LanguageSelector'
import { useAuthentication } from '../features/auth/context'
import { useState } from 'react'

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
          <NavLink to="/" className="text-xl font-bold text-ink">
            IT Useful
          </NavLink>
          {state.status === 'owner' && (
            <nav aria-label={t.nav} className="flex flex-wrap gap-5">
              <NavLink
                to="/"
                end
                className="text-brand underline-offset-4 hover:underline aria-[current=page]:font-bold aria-[current=page]:underline"
              >
                {t.definitions}
              </NavLink>
              <NavLink
                to="/elements/new"
                className="text-brand underline-offset-4 hover:underline aria-[current=page]:font-bold aria-[current=page]:underline"
              >
                {t.create}
              </NavLink>
            </nav>
          )}
          <LanguageSelector />
          {state.status === 'owner' && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {state.local ? t.localMode : `${t.signedInAs} ${state.login}`}
              </span>
              {!state.local && (
                <button
                  type="button"
                  disabled={loggingOut}
                  className="text-brand underline disabled:opacity-50"
                  onClick={() => {
                    setLogoutFailed(false)
                    void logout().catch(() => setLogoutFailed(true))
                  }}
                >
                  {loggingOut ? t.loggingOut : t.logout}
                </button>
              )}
            </div>
          )}
        </div>
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
      <footer className="mx-auto max-w-5xl px-6 py-6 text-sm text-muted">
        {t.footer}
      </footer>
    </>
  )
}
