import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, expect, test } from 'vitest'
import App from '../../App'
import { server } from '../../test/server'

const csrf = { headerName: 'X-CSRF-TOKEN', token: 'session-csrf-token' }
const adminSession = {
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'CONFIRMED',
  csrf,
}
const definitions = [
  {
    id: 'old-id',
    slug: 'ftp',
    titles: { EN: 'FTP' },
    updatedAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'new-id',
    slug: 'http',
    titles: { EN: 'HTTP' },
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'mid-id',
    slug: 'dns',
    titles: { EN: 'DNS' },
    updatedAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'oldest-id',
    slug: 'smtp',
    titles: { EN: 'SMTP' },
    updatedAt: '2025-12-01T10:00:00Z',
  },
]

beforeEach(() => localStorage.clear())

function renderApp(path: string, authenticationEnabled = false) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <App authenticationEnabled={authenticationEnabled} />,
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

function serveDefinitions() {
  server.use(
    http.get('http://localhost/api/elements', () =>
      HttpResponse.json(definitions),
    ),
  )
}

function card(name: string) {
  return screen.getByRole('region', { name })
}

test('dashboard shows a card per section with definition count and latest changes', async () => {
  serveDefinitions()
  renderApp('/')

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible()
  const definitionsCard = card('IT definitions')
  expect(
    await within(definitionsCard).findByText('4 definitions'),
  ).toBeVisible()
  const latest = within(definitionsCard)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
  expect(latest).toHaveLength(3)
  expect(latest[0]).toContain('HTTP')
  expect(latest[1]).toContain('DNS')
  expect(latest[2]).toContain('FTP')
  expect(
    within(definitionsCard).getByRole('link', { name: 'HTTP' }),
  ).toHaveAttribute('href', '/it-definitions/new-id')
  expect(
    within(definitionsCard).getByRole('link', { name: 'Open IT definitions' }),
  ).toHaveAttribute('href', '/it-definitions')

  const settingsCard = card('Settings')
  expect(within(settingsCard).getByText('English')).toBeVisible()
  expect(within(settingsCard).getByText('Local mode')).toBeVisible()
  expect(
    within(settingsCard).getByRole('link', { name: 'Open settings' }),
  ).toHaveAttribute('href', '/settings')
  expect(document.title).toBe('Dashboard | IT Useful')
})

test('main menu has three tabs and each section shows its own sub-tabs', async () => {
  renderApp('/it-definitions')
  const main = await screen.findByRole('navigation', {
    name: 'Main navigation',
  })
  expect(
    within(main)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Dashboard', 'IT definitions', 'Settings'])
  expect(
    within(main).getByRole('link', { name: 'IT definitions' }),
  ).toHaveAttribute('aria-current', 'page')
  const section = screen.getByRole('navigation', { name: 'Section navigation' })
  expect(
    within(section)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['All definitions', 'New definition'])

  await userEvent.click(within(main).getByRole('link', { name: 'Settings' }))
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible()
  expect(
    within(screen.getByRole('navigation', { name: 'Section navigation' }))
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['General'])
  expect(
    within(screen.getByRole('main')).getByRole('combobox', {
      name: 'Interface language',
    }),
  ).toHaveValue('en')
  expect(
    screen.getAllByRole('combobox', { name: 'Interface language' }),
  ).toHaveLength(1)
})

test('the dashboard has no section sub-tabs', async () => {
  renderApp('/')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('navigation', { name: 'Section navigation' }),
  ).not.toBeInTheDocument()
})

test('an admin sees accounts waiting for confirmation and open invitations', async () => {
  serveDefinitions()
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.get('http://localhost/api/admin/accounts', () =>
      HttpResponse.json([
        {
          id: 'a1',
          email: 'admin@example.com',
          role: 'ADMIN',
          status: 'CONFIRMED',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'a2',
          email: 'waiting@example.com',
          role: 'USER',
          status: 'ACCEPTED',
          createdAt: '2026-01-02T00:00:00Z',
        },
      ]),
    ),
    http.get('http://localhost/api/admin/invitations', () =>
      HttpResponse.json([
        {
          id: 'i1',
          email: 'one@example.com',
          role: 'USER',
          expiresAt: '2026-12-01T00:00:00Z',
        },
        {
          id: 'i2',
          email: 'two@example.com',
          role: 'USER',
          expiresAt: '2026-12-01T00:00:00Z',
        },
      ]),
    ),
  )
  renderApp('/', true)

  const settingsCard = await screen.findByRole('region', { name: 'Settings' })
  expect(within(settingsCard).getByText('admin@example.com')).toBeVisible()
  expect(
    await within(settingsCard).findByText('1 account waiting for confirmation'),
  ).toBeVisible()
  expect(within(settingsCard).getByText('2 open invitations')).toBeVisible()
  expect(
    within(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).getByRole('link', { name: 'Settings' }),
  ).toHaveAttribute('href', '/settings')
})

test('a user sees no account administration figures on the dashboard', async () => {
  let adminReads = 0
  serveDefinitions()
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({
        ...adminSession,
        email: 'user@example.com',
        role: 'USER',
      }),
    ),
    http.get('http://localhost/api/admin/*', () => {
      adminReads++
      return HttpResponse.json([])
    }),
  )
  renderApp('/', true)

  const settingsCard = await screen.findByRole('region', { name: 'Settings' })
  expect(within(settingsCard).getByText('user@example.com')).toBeVisible()
  expect(
    within(settingsCard).queryByText(/waiting for confirmation/),
  ).not.toBeInTheDocument()
  expect(adminReads).toBe(0)
})

test('signing in opens the dashboard', async () => {
  let signedIn = false
  server.use(
    http.get('http://localhost/api/session', () =>
      signedIn
        ? HttpResponse.json({ ...adminSession, role: 'USER' })
        : HttpResponse.json(
            { code: 'authentication_required' },
            { status: 401 },
          ),
    ),
    http.get('http://localhost/api/session/csrf', () =>
      HttpResponse.json({ headerName: 'X-CSRF-TOKEN', token: 'anonymous' }),
    ),
    http.post('http://localhost/api/session/login', () => {
      signedIn = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const router = renderApp('/sign-in', true)

  await userEvent.type(
    await screen.findByLabelText('Email address'),
    'user@example.com',
  )
  await userEvent.type(screen.getByLabelText('Password'), 'secret password')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/')
})

test.each([
  ['/admin/accounts', '/settings/accounts', 'Accounts'],
  ['/account/password', '/settings/password', 'Change password'],
])('the old address %s opens %s', async (oldPath, newPath, heading) => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.get('http://localhost/api/admin/*', () => HttpResponse.json([])),
  )
  const router = renderApp(oldPath, true)

  expect(
    await screen.findByRole('heading', { level: 1, name: heading }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe(newPath)
  expect(
    within(screen.getByRole('navigation', { name: 'Section navigation' }))
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['General', 'Accounts', 'Change password'])
})

test('the latest definitions use English titles like the list, whatever the interface language', async () => {
  localStorage.setItem('it-useful.ui-language', 'de')
  server.use(
    http.get('http://localhost/api/elements', () =>
      HttpResponse.json([
        {
          id: 'http-id',
          slug: 'http',
          titles: { EN: 'HTTP', DE: 'HTTP auf Deutsch' },
          updatedAt: '2026-03-01T10:00:00Z',
        },
      ]),
    ),
  )
  renderApp('/')

  const definitionsCard = await screen.findByRole('region', {
    name: 'IT-Begriffe',
  })
  expect(
    await within(definitionsCard).findByRole('link', { name: 'HTTP' }),
  ).toHaveAttribute('href', '/it-definitions/http-id')
  expect(within(definitionsCard).getByText('1 Begriff')).toBeVisible()
})

test.each(['/settings', '/settings/'])(
  'the interface language stays selectable once on %s while waiting for confirmation',
  async (path) => {
    server.use(
      http.get('http://localhost/api/session', () =>
        HttpResponse.json({
          ...adminSession,
          role: 'USER',
          status: 'ACCEPTED',
        }),
      ),
    )
    renderApp(path, true)

    expect(
      await screen.findByRole('heading', { name: 'Waiting for confirmation' }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: 'Interface language' }),
    ).toHaveLength(1)
  },
)

test('a signed-in user on /settings/ sees one language selector', async () => {
  renderApp('/settings/')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible()
  expect(
    screen.getAllByRole('combobox', { name: 'Interface language' }),
  ).toHaveLength(1)
})

test('a signed-out user with an old bookmark lands on the new address after sign-in', async () => {
  let signedIn = false
  server.use(
    http.get('http://localhost/api/session', () =>
      signedIn
        ? HttpResponse.json(adminSession)
        : HttpResponse.json(
            { code: 'authentication_required' },
            { status: 401 },
          ),
    ),
    http.get('http://localhost/api/session/csrf', () =>
      HttpResponse.json({ headerName: 'X-CSRF-TOKEN', token: 'anonymous' }),
    ),
    http.post('http://localhost/api/session/login', () => {
      signedIn = true
      return new HttpResponse(null, { status: 204 })
    }),
    http.get('http://localhost/api/admin/*', () => HttpResponse.json([])),
  )
  const router = renderApp('/admin/accounts', true)

  await userEvent.type(
    await screen.findByLabelText('Email address'),
    'admin@example.com',
  )
  await userEvent.type(screen.getByLabelText('Password'), 'secret password')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Accounts' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/settings/accounts')
})

test.each(['/it-definitionsx', '/settings-old'])(
  'the unknown address %s shows no section sub-tabs',
  async (path) => {
    renderApp(path)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('navigation', { name: 'Section navigation' }),
    ).not.toBeInTheDocument()
  },
)

test('the definition list lives at /it-definitions under the IT definitions tab', async () => {
  serveDefinitions()
  renderApp('/it-definitions')

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'A home for your IT knowledge',
    }),
  ).toBeVisible()
  expect(
    within(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).getByRole('link', { name: 'IT definitions' }),
  ).toHaveAttribute('aria-current', 'page')
  expect(await screen.findByRole('link', { name: 'HTTP' })).toHaveAttribute(
    'href',
    '/it-definitions/new-id',
  )
})

test.each([
  ['/elements', '/it-definitions'],
  ['/elements/new', '/it-definitions/new'],
  ['/elements/new-id?language=DE', '/it-definitions/new-id?language=DE'],
  ['/elements/new-id/edit', '/it-definitions/new-id/edit'],
])('the old address %s opens %s', async (oldPath, newPath) => {
  const router = renderApp(oldPath)

  expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
  expect(
    `${router.state.location.pathname}${router.state.location.search}`,
  ).toBe(newPath)
})

test('an old definition link keeps its section anchor', async () => {
  const router = renderApp('/elements/new-id?language=DE#examples')

  expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
  const { pathname, search, hash } = router.state.location
  expect(`${pathname}${search}${hash}`).toBe(
    '/it-definitions/new-id?language=DE#examples',
  )
})

test('a signed-out user with an old definition link lands on the new address after sign-in', async () => {
  let signedIn = false
  server.use(
    http.get('http://localhost/api/session', () =>
      signedIn
        ? HttpResponse.json({ ...adminSession, role: 'USER' })
        : HttpResponse.json(
            { code: 'authentication_required' },
            { status: 401 },
          ),
    ),
    http.get('http://localhost/api/session/csrf', () =>
      HttpResponse.json({ headerName: 'X-CSRF-TOKEN', token: 'anonymous' }),
    ),
    http.post('http://localhost/api/session/login', () => {
      signedIn = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const router = renderApp('/elements/a%2Fb?language=DE', true)

  await userEvent.type(
    await screen.findByLabelText('Email address'),
    'user@example.com',
  )
  await userEvent.type(screen.getByLabelText('Password'), 'secret password')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Definition details',
    }),
  ).toBeVisible()
  const { pathname, search } = router.state.location
  expect(`${pathname}${search}`).toBe('/it-definitions/a%2Fb?language=DE')
})
