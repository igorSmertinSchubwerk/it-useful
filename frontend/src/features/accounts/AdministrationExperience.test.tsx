import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from '../../App'
import { server } from '../../test/server'
import { elementFixture } from '../../test/elementFixture'

const csrf = { headerName: 'X-CSRF-TOKEN', token: 'session-csrf-token' }
const adminSession = {
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'CONFIRMED',
  csrf,
}
const userSession = {
  ...adminSession,
  email: 'reader@example.com',
  role: 'USER',
}
const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'a different horse battery staple'
const READER_ID = '00000000-0000-0000-0000-0000000000e1'

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

function adminWithAccounts(account: Record<string, unknown>) {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.get('http://localhost/api/admin/accounts', () =>
      HttpResponse.json([account]),
    ),
    http.get('http://localhost/api/admin/invitations', () =>
      HttpResponse.json([]),
    ),
  )
}

test('an admin changes a role, disables, enables, and sees the last-admin refusal', async () => {
  const user = userEvent.setup()
  const reader = {
    id: READER_ID,
    email: 'reader@example.com',
    role: 'USER',
    status: 'CONFIRMED',
    createdAt: '2026-11-24T09:00:00Z',
  }
  const calls: string[] = []
  adminWithAccounts(reader)
  server.use(
    http.get('http://localhost/api/admin/accounts', () =>
      HttpResponse.json([reader]),
    ),
    http.put(
      'http://localhost/api/admin/accounts/:id/role',
      async ({ request }) => {
        const body = (await request.json()) as { role: string }
        calls.push(`role ${body.role}`)
        reader.role = body.role
        return new HttpResponse(null, { status: 204 })
      },
    ),
    http.post('http://localhost/api/admin/accounts/:id/disable', () => {
      calls.push('disable')
      if (calls.filter((call) => call === 'disable').length > 1)
        return HttpResponse.json({ code: 'last_admin' }, { status: 409 })
      reader.status = 'DISABLED'
      return new HttpResponse(null, { status: 204 })
    }),
    http.post('http://localhost/api/admin/accounts/:id/enable', () => {
      calls.push('enable')
      reader.status = 'CONFIRMED'
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderServerApp('/admin/accounts')
  const row = (await screen.findByText('reader@example.com')).closest('tr')!

  await user.click(
    within(row).getByRole('button', {
      name: 'Make admin reader@example.com',
    }),
  )
  expect(await within(row).findByText('Admin')).toBeVisible()
  await user.click(
    within(row).getByRole('button', { name: 'Disable reader@example.com' }),
  )
  expect(await within(row).findByText('Disabled')).toBeVisible()
  await user.click(
    within(row).getByRole('button', { name: 'Enable reader@example.com' }),
  )
  expect(await within(row).findByText('Confirmed')).toBeVisible()
  await user.click(
    within(row).getByRole('button', { name: 'Disable reader@example.com' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The last admin cannot be disabled or made a user.',
  )
  expect(calls).toEqual(['role ADMIN', 'disable', 'enable', 'disable'])
})

test('an admin creates a one-time password reset link and copies it', async () => {
  const user = userEvent.setup()
  const link = 'https://it-useful.example/reset-password#reset-token'
  adminWithAccounts({
    id: READER_ID,
    email: 'reader@example.com',
    role: 'USER',
    status: 'CONFIRMED',
    createdAt: '2026-11-24T09:00:00Z',
  })
  server.use(
    http.post('http://localhost/api/admin/accounts/:id/password-resets', () =>
      HttpResponse.json(
        {
          id: '00000000-0000-0000-0000-0000000000f1',
          expiresAt: '2026-11-25T09:00:00Z',
          link,
        },
        { status: 201 },
      ),
    ),
  )
  renderServerApp('/admin/accounts')

  await user.click(
    await screen.findByRole('button', {
      name: 'Create reset link reader@example.com',
    }),
  )

  expect(await screen.findByLabelText('Password reset link')).toHaveValue(link)
  expect(
    screen.getByText(
      'Send this link to reader@example.com. It works once within 24 hours and is shown only once.',
    ),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Copy reset link' }))
  expect(await navigator.clipboard.readText()).toBe(link)
})

test('an admin revokes an open invitation', async () => {
  const user = userEvent.setup()
  let open = true
  let revoked: string | null = null
  adminWithAccounts({
    id: READER_ID,
    email: 'reader@example.com',
    role: 'USER',
    status: 'CONFIRMED',
    createdAt: '2026-11-24T09:00:00Z',
  })
  server.use(
    http.get('http://localhost/api/admin/invitations', () =>
      HttpResponse.json(
        open
          ? [
              {
                id: '00000000-0000-0000-0000-0000000000b2',
                email: 'invited@example.com',
                role: 'USER',
                expiresAt: '2026-12-01T09:00:00Z',
              },
            ]
          : [],
      ),
    ),
    http.delete('http://localhost/api/admin/invitations/:id', ({ params }) => {
      revoked = String(params.id)
      open = false
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderServerApp('/admin/accounts')

  await user.click(
    await screen.findByRole('button', {
      name: 'Revoke invitation for invited@example.com',
    }),
  )

  expect(await screen.findByText('No open invitations.')).toBeVisible()
  expect(revoked).toBe('00000000-0000-0000-0000-0000000000b2')
})

test('a person chooses a new password from a reset link and lands on sign-in', async () => {
  const user = userEvent.setup()
  let body: unknown = null
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'authentication_required' }, { status: 401 }),
    ),
    http.get('http://localhost/api/session/csrf', () =>
      HttpResponse.json({ headerName: 'X-CSRF-TOKEN', token: 'anonymous' }),
    ),
    http.post(
      'http://localhost/api/password-resets/complete',
      async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      },
    ),
  )
  renderServerApp('/reset-password#reset-token')

  await user.type(await screen.findByLabelText('New password'), NEW_PASSWORD)
  await user.type(screen.getByLabelText('Repeat password'), NEW_PASSWORD)
  await user.click(screen.getByRole('button', { name: 'Set new password' }))

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Your password is changed. Sign in with the new password.',
  )
  expect(body).toEqual({ token: 'reset-token', password: NEW_PASSWORD })
})

test('a signed-in person changes the password after proving the current one', async () => {
  const user = userEvent.setup()
  let attempts = 0
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(userSession),
    ),
    http.post('http://localhost/api/session/password', async ({ request }) => {
      attempts++
      const body = (await request.json()) as { currentPassword: string }
      return body.currentPassword === PASSWORD
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json(
            { code: 'current_password_incorrect' },
            { status: 400 },
          )
    }),
  )
  renderServerApp('/account/password')

  await user.type(
    await screen.findByLabelText('Current password'),
    'wrong current password',
  )
  await user.type(screen.getByLabelText('New password'), NEW_PASSWORD)
  await user.type(screen.getByLabelText('Repeat password'), NEW_PASSWORD)
  await user.click(screen.getByRole('button', { name: 'Change password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The current password is incorrect.',
  )

  await user.clear(screen.getByLabelText('Current password'))
  await user.type(screen.getByLabelText('Current password'), PASSWORD)
  await user.click(screen.getByRole('button', { name: 'Change password' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Your password is changed. Your other sessions are signed out.',
  )
  expect(attempts).toBe(2)
})

test('a user sees no create, edit, or delete controls and cannot open the editor', async () => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(userSession),
    ),
    http.get('http://localhost/api/elements', () =>
      HttpResponse.json([
        {
          id: 'example-id',
          slug: 'http',
          titles: { EN: 'HTTP', DE: 'HTTP auf Deutsch', RU: 'HTTP по-русски' },
          updatedAt: '2026-09-04T12:00:00Z',
        },
      ]),
    ),
    http.get('http://localhost/api/elements/example-id', () =>
      HttpResponse.json(elementFixture),
    ),
  )
  renderServerApp('/')

  expect(await screen.findByText('HTTP')).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'New definition' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /^Edit/ })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /^Delete/ }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Change password' })).toBeVisible()
})

test('a user who opens an editor route sees that only admins can edit', async () => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(userSession),
    ),
  )
  renderServerApp('/elements/new')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Only admins can create or change definitions.',
  )
})
