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

function adminAccountsPage() {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.get('http://localhost/api/admin/accounts', () =>
      HttpResponse.json([
        {
          id: '00000000-0000-0000-0000-0000000000e1',
          email: 'reader@example.com',
          role: 'USER',
          status: 'CONFIRMED',
          createdAt: '2026-11-24T09:00:00Z',
        },
      ]),
    ),
    http.get('http://localhost/api/admin/invitations', () =>
      HttpResponse.json([]),
    ),
  )
  render(
    <RouterProvider
      router={createMemoryRouter(
        [{ path: '*', element: <App authenticationEnabled /> }],
        { initialEntries: ['/settings/accounts'] },
      )}
    />,
  )
}

test('ac25 tells the admin when the invitation email went out', async () => {
  const user = userEvent.setup()
  adminAccountsPage()
  server.use(
    http.post('http://localhost/api/admin/invitations', () =>
      HttpResponse.json(
        {
          id: '00000000-0000-0000-0000-0000000000b1',
          email: 'new.person@example.com',
          role: 'USER',
          expiresAt: '2026-12-01T09:00:00Z',
          link: 'https://it-useful.example/accept-invitation#token',
          emailSent: true,
        },
        { status: 201 },
      ),
    ),
  )

  await user.type(
    await screen.findByLabelText('Email address'),
    'new.person@example.com',
  )
  await user.click(screen.getByRole('button', { name: 'Create invitation' }))

  expect(
    await screen.findByText(
      'We emailed the invitation to new.person@example.com. You can also copy the link.',
    ),
  ).toBeVisible()
})

test('ac25 tells the admin when the reset email went out', async () => {
  const user = userEvent.setup()
  adminAccountsPage()
  server.use(
    http.post('http://localhost/api/admin/accounts/:id/password-resets', () =>
      HttpResponse.json(
        {
          id: '00000000-0000-0000-0000-0000000000f1',
          expiresAt: '2026-11-25T09:00:00Z',
          link: 'https://it-useful.example/reset-password#token',
          emailSent: true,
        },
        { status: 201 },
      ),
    ),
  )

  await user.click(
    await screen.findByRole('button', {
      name: 'Create reset link reader@example.com',
    }),
  )

  expect(
    await screen.findByText(
      'We emailed the reset link to reader@example.com. You can also copy it.',
    ),
  ).toBeVisible()
})
