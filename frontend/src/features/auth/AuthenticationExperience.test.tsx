import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from '../../App'
import { server } from '../../test/server'

const session = {
  authenticated: true,
  role: 'OWNER',
  login: 'approved-owner',
  csrf: { headerName: 'X-CSRF-TOKEN', token: 'session-csrf-token' },
}

function renderServerApp(path = '/') {
  render(
    <RouterProvider
      router={createMemoryRouter(
        [{ path: '*', element: <App authenticationEnabled /> }],
        { initialEntries: [path] },
      )}
    />,
  )
}

test('shows an accessible GitHub sign-in without loading private data', async () => {
  let privateReads = 0
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'authentication_required' }, { status: 401 }),
    ),
    http.get('http://localhost/api/elements', () => {
      privateReads++
      return HttpResponse.json([])
    }),
  )
  renderServerApp('/elements/new')
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Sign in with GitHub' }),
  ).toHaveAttribute('href', '/oauth2/authorization/github')
  expect(privateReads).toBe(0)
})

test('distinguishes a denied GitHub identity from an unavailable session', async () => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'forbidden' }, { status: 403 }),
    ),
  )
  renderServerApp()
  expect(
    await screen.findByRole('heading', { name: 'Access denied' }),
  ).toBeVisible()
  expect(screen.getByText(/not the configured owner/)).toBeVisible()
})

test('renders the owner shell and signs out with its in-memory CSRF token', async () => {
  let logoutHeader: string | null = null
  server.use(
    http.get('http://localhost/api/session', () => HttpResponse.json(session)),
    http.post('http://localhost/logout', ({ request }) => {
      logoutHeader = request.headers.get('X-CSRF-TOKEN')
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderServerApp()
  expect(await screen.findByText('Signed in as approved-owner')).toBeVisible()
  expect(screen.getByRole('navigation')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(logoutHeader).toBe('session-csrf-token')
})

test('clears private UI and reports expiry when an authenticated request gets 401', async () => {
  let expired = false
  server.use(
    http.get('http://localhost/api/session', () => HttpResponse.json(session)),
    http.get('http://localhost/api/elements', () =>
      expired
        ? HttpResponse.json(
            { code: 'authentication_required' },
            { status: 401 },
          )
        : HttpResponse.json([]),
    ),
  )
  renderServerApp()
  expect(
    await screen.findByRole('heading', {
      name: 'A home for your IT knowledge',
    }),
  ).toBeVisible()
  expired = true
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(
    await screen.findByRole('heading', { name: 'Session expired' }),
  ).toBeVisible()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign in again' })).toBeVisible()
})
