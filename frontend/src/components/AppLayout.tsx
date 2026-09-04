import { NavLink, Outlet } from 'react-router-dom'
import { useRouteAccessibility } from '../hooks/useRouteAccessibility'

export function AppLayout() {
  useRouteAccessibility()
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <NavLink to="/" className="text-xl font-bold text-ink">
            IT Useful
          </NavLink>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-5">
            <NavLink
              to="/"
              end
              className="text-brand underline-offset-4 hover:underline aria-[current=page]:font-bold aria-[current=page]:underline"
            >
              Definitions
            </NavLink>
            <NavLink
              to="/elements/new"
              className="text-brand underline-offset-4 hover:underline aria-[current=page]:font-bold aria-[current=page]:underline"
            >
              New definition
            </NavLink>
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-h-[70vh] max-w-5xl px-6 py-12 sm:py-16"
      >
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-6 py-6 text-sm text-muted">
        English, German, and Russian IT knowledge. Navigation preview — data is
        not connected yet.
      </footer>
    </>
  )
}
