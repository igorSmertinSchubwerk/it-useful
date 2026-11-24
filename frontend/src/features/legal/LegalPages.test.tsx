import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from '../../App'
import { server } from '../../test/server'

function renderAnonymousServerApp(path: string) {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'authentication_required' }, { status: 401 }),
    ),
  )
  render(
    <RouterProvider
      router={createMemoryRouter(
        [{ path: '*', element: <App authenticationEnabled /> }],
        { initialEntries: [path] },
      )}
    />,
  )
}

test('ac24 the sign-in page links to the legal notice, which names the operator without sign-in', async () => {
  const user = userEvent.setup()
  renderAnonymousServerApp('/sign-in')

  await user.click(await screen.findByRole('link', { name: 'Legal notice' }))

  expect(
    await screen.findByRole('heading', { name: 'Impressum', level: 1 }),
  ).toBeVisible()
  expect(screen.getAllByText(/schubwerk GmbH/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/HRB 30848/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/DE322073579/).length).toBeGreaterThan(0)
  expect(
    screen.getByText(
      'The German text is binding. The English translation is provided for convenience.',
    ),
  ).toBeVisible()
})

test('ac24 the privacy policy is reachable without sign-in and names the session cookie', async () => {
  const user = userEvent.setup()
  renderAnonymousServerApp('/sign-in')

  await user.click(await screen.findByRole('link', { name: 'Privacy policy' }))

  expect(
    await screen.findByRole('heading', {
      name: 'Datenschutzerklärung',
      level: 1,
    }),
  ).toBeVisible()
  expect(screen.getAllByText(/IT_USEFUL_SESSION/).length).toBeGreaterThan(0)
  expect(
    screen.getByRole('heading', {
      name: 'Privacy policy (English translation)',
    }),
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Sign in' }),
  ).not.toBeInTheDocument()
})
