import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from '../../App'
import { server } from '../../test/server'

const csrf = { headerName: 'X-CSRF-TOKEN', token: 'session-csrf-token' }
const adminSession = {
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'CONFIRMED',
  csrf,
}
const PASSWORD = 'correct horse battery staple'

function renderServerApp(path: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(
        [{ path: '*', element: <App authenticationEnabled /> }],
        { initialEntries: [path] },
      )}
    />,
  )
}

function anonymousWithCsrf() {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'authentication_required' }, { status: 401 }),
    ),
    http.get('http://localhost/api/session/csrf', () =>
      HttpResponse.json({
        headerName: 'X-CSRF-TOKEN',
        token: 'anonymous-csrf-token',
      }),
    ),
  )
}

async function choosePassword(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  repeated = password,
) {
  await user.type(await screen.findByLabelText('New password'), password)
  await user.type(screen.getByLabelText('Repeat password'), repeated)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

test('accepts an invitation with the token from the link and opens sign-in with a notice', async () => {
  const user = userEvent.setup()
  let accepted: { csrf: string | null; body: unknown } | null = null
  anonymousWithCsrf()
  server.use(
    http.post(
      'http://localhost/api/invitations/accept',
      async ({ request }) => {
        accepted = {
          csrf: request.headers.get('X-CSRF-TOKEN'),
          body: await request.json(),
        }
        return new HttpResponse(null, { status: 204 })
      },
    ),
  )
  renderServerApp('/accept-invitation#invitation-token-123')

  await choosePassword(user, PASSWORD)

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent(
    'Your account is ready. Sign in with your email address and password.',
  )
  expect(accepted).toEqual({
    csrf: 'anonymous-csrf-token',
    body: { token: 'invitation-token-123', password: PASSWORD },
  })
})

test('explains mismatched entries, rejected passwords, and invalid links', async () => {
  const user = userEvent.setup()
  let response = HttpResponse.json(
    { code: 'password_rejected', violation: 'TOO_COMMON' },
    { status: 400 },
  )
  let requests = 0
  anonymousWithCsrf()
  server.use(
    http.post('http://localhost/api/invitations/accept', () => {
      requests++
      return response
    }),
  )
  renderServerApp('/accept-invitation#invitation-token-123')

  await choosePassword(user, PASSWORD, `${PASSWORD}!`)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The passwords do not match.',
  )
  expect(requests).toBe(0)

  await user.clear(screen.getByLabelText('Repeat password'))
  await user.type(screen.getByLabelText('Repeat password'), PASSWORD)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This password is too common.',
  )

  response = HttpResponse.json({ code: 'invitation_invalid' }, { status: 400 })
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This invitation link is invalid or has expired.',
  )
})

test('shows an accepted account the waiting page until an admin confirms it', async () => {
  const user = userEvent.setup()
  let confirmed = false
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({
        email: 'pending@example.com',
        role: 'USER',
        status: confirmed ? 'CONFIRMED' : 'ACCEPTED',
        csrf,
      }),
    ),
    http.get('http://localhost/api/elements', () => HttpResponse.json([])),
  )
  renderServerApp('/')

  expect(
    await screen.findByRole('heading', { name: 'Waiting for confirmation' }),
  ).toBeVisible()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()

  confirmed = true
  await user.click(screen.getByRole('button', { name: 'Check again' }))
  expect(
    await screen.findByText('Signed in as pending@example.com'),
  ).toBeVisible()
})

test('lets an admin invite a person and copy the one-time link', async () => {
  const user = userEvent.setup()
  const link = 'https://it-useful.example/accept-invitation#new-token'
  let exists = false
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.get('http://localhost/api/admin/accounts', () =>
      HttpResponse.json([]),
    ),
    http.post('http://localhost/api/admin/invitations', () =>
      exists
        ? HttpResponse.json({ code: 'account_exists' }, { status: 409 })
        : HttpResponse.json(
            {
              id: '00000000-0000-0000-0000-0000000000b1',
              email: 'new.person@example.com',
              role: 'USER',
              expiresAt: '2026-12-01T09:00:00Z',
              link,
            },
            { status: 201 },
          ),
    ),
  )
  renderServerApp('/admin/accounts')

  await user.type(
    await screen.findByLabelText('Email address'),
    'new.person@example.com',
  )
  await user.selectOptions(screen.getByLabelText('Role'), 'USER')
  await user.click(screen.getByRole('button', { name: 'Create invitation' }))

  expect(await screen.findByLabelText('Invitation link')).toHaveValue(link)
  expect(
    screen.getByText('Send this link to the person. It is shown only once.'),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Copy link' }))
  expect(await navigator.clipboard.readText()).toBe(link)

  exists = true
  await user.click(screen.getByRole('button', { name: 'Create invitation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'An account with this email address already exists.',
  )
})

test('lets an admin confirm a pending account', async () => {
  const user = userEvent.setup()
  let confirmed = false
  let confirmRequest: string | null = null
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.get('http://localhost/api/admin/accounts', () =>
      HttpResponse.json([
        {
          id: '00000000-0000-0000-0000-0000000000c1',
          email: 'pending@example.com',
          role: 'USER',
          status: confirmed ? 'CONFIRMED' : 'ACCEPTED',
          createdAt: '2026-11-24T09:00:00Z',
        },
      ]),
    ),
    http.post(
      'http://localhost/api/admin/accounts/:id/confirm',
      ({ params, request }) => {
        confirmRequest = `${String(params.id)} ${request.headers.get('X-CSRF-TOKEN')}`
        confirmed = true
        return new HttpResponse(null, { status: 204 })
      },
    ),
  )
  renderServerApp('/admin/accounts')

  const row = (await screen.findByText('pending@example.com')).closest('tr')!
  expect(within(row).getByText('Waiting for confirmation')).toBeVisible()
  await user.click(
    within(row).getByRole('button', { name: 'Confirm pending@example.com' }),
  )

  expect(await within(row).findByText('Confirmed')).toBeVisible()
  expect(confirmRequest).toBe(
    '00000000-0000-0000-0000-0000000000c1 session-csrf-token',
  )
})

test('shows the Accounts link only to admins', async () => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ ...adminSession, role: 'USER' }),
    ),
    http.get('http://localhost/api/elements', () => HttpResponse.json([])),
  )
  renderServerApp('/')

  expect(await screen.findByRole('navigation')).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Accounts' }),
  ).not.toBeInTheDocument()
})
