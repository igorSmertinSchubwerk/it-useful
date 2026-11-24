import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from '../../App'
import { server } from '../../test/server'

const adminSession = {
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'CONFIRMED',
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

function anonymousUntilSignedIn() {
  let signedIn = false
  let signInRequest: { csrf: string | null; body: string } | null = null
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
      HttpResponse.json({
        headerName: 'X-CSRF-TOKEN',
        token: 'anonymous-csrf-token',
      }),
    ),
    http.post('http://localhost/api/session/login', async ({ request }) => {
      signInRequest = {
        csrf: request.headers.get('X-CSRF-TOKEN'),
        body: await request.text(),
      }
      signedIn = true
      return new HttpResponse(null, { status: 204 })
    }),
    http.get('http://localhost/api/elements', () => HttpResponse.json([])),
  )
  return () => signInRequest
}

async function submitSignIn(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('Email address'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

test('shows an accessible email sign-in without loading private data', async () => {
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
  expect(screen.getByLabelText('Email address')).toHaveAttribute(
    'autocomplete',
    'username',
  )
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  expect(privateReads).toBe(0)
})

test('signs in with a fresh CSRF token and opens the signed-in shell', async () => {
  const signInRequest = anonymousUntilSignedIn()
  renderServerApp()
  await screen.findByRole('heading', { name: 'Sign in' })

  await submitSignIn('admin@example.com', 'correct horse battery staple')

  expect(
    await screen.findByText('Signed in as admin@example.com'),
  ).toBeVisible()
  expect(signInRequest()).toEqual({
    csrf: 'anonymous-csrf-token',
    body: 'email=admin%40example.com&password=correct+horse+battery+staple',
  })
})

test('shows one generic message for rejected credentials and a throttling message', async () => {
  let status = 401
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'authentication_required' }, { status: 401 }),
    ),
    http.get('http://localhost/api/session/csrf', () =>
      HttpResponse.json({ headerName: 'X-CSRF-TOKEN', token: 'token' }),
    ),
    http.post('http://localhost/api/session/login', () =>
      HttpResponse.json({ code: 'sign_in_failed' }, { status }),
    ),
  )
  renderServerApp()
  await screen.findByRole('heading', { name: 'Sign in' })

  await submitSignIn('someone@example.com', 'wrong password value')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The email address or password is incorrect.',
  )

  status = 429
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Too many sign-in attempts.',
  )
})

test('keeps a disabled account out of the application', async () => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ ...adminSession, status: 'DISABLED' }),
    ),
  )
  renderServerApp()
  expect(
    await screen.findByRole('heading', { name: 'Access denied' }),
  ).toBeVisible()
  expect(screen.getByText(/not confirmed/)).toBeVisible()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

test('treats a forbidden session check as denied', async () => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'forbidden' }, { status: 403 }),
    ),
  )
  renderServerApp()
  expect(
    await screen.findByRole('heading', { name: 'Access denied' }),
  ).toBeVisible()
})

test('renders the signed-in shell and signs out with its in-memory CSRF token', async () => {
  let logoutHeader: string | null = null
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.post('http://localhost/logout', ({ request }) => {
      logoutHeader = request.headers.get('X-CSRF-TOKEN')
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderServerApp()
  expect(
    await screen.findByText('Signed in as admin@example.com'),
  ).toBeVisible()
  expect(screen.getByRole('navigation')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(logoutHeader).toBe('session-csrf-token')
})

test('clears private UI and reports expiry when an authenticated request gets 401', async () => {
  let expired = false
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
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
  expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
    'href',
    '/sign-in',
  )
})
