import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, test } from 'vitest'
import App from '../App'
import { server } from './server'
import { elementFixture } from './elementFixture'
import type { ElementWriteRequest } from '../api/contracts'

beforeEach(() => localStorage.clear())
function mount(path = '/') {
  const router = createMemoryRouter([{ path: '*', element: <App /> }], {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
  return router
}
const list = [
  {
    id: elementFixture.id,
    slug: 'http',
    titles: { EN: 'HTTP', DE: 'Deutsch HTTP' },
    updatedAt: elementFixture.updatedAt,
  },
]

test('list handles loaded records, content language, search and no matches', async () => {
  server.use(
    http.get('http://localhost/api/elements', () => HttpResponse.json(list)),
  )
  mount()
  const user = userEvent.setup()
  expect(await screen.findByRole('link', { name: 'HTTP' })).toBeVisible()
  await user.selectOptions(screen.getByLabelText('Definition language'), 'DE')
  expect(screen.getByRole('link', { name: 'Deutsch HTTP' })).toHaveAttribute(
    'lang',
    'de',
  )
  await user.type(screen.getByLabelText('Search title or slug'), 'absent')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Clear search and sorting' }),
  )
  expect(screen.getByRole('table')).toBeVisible()
})

test('list recovers from a failed read to an empty catalogue', async () => {
  let fail = true
  server.use(
    http.get('http://localhost/api/elements', () =>
      fail ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json([]),
    ),
  )
  mount()
  expect(await screen.findByRole('alert')).toBeVisible()
  fail = false
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  )
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('0 / 0')
})

test('edit submits three translations and renders the saved detail', async () => {
  let payload: ElementWriteRequest | undefined
  server.use(
    http.put(
      'http://localhost/api/elements/example-id',
      async ({ request }) => {
        payload = (await request.json()) as ElementWriteRequest
        return HttpResponse.json({ ...elementFixture, ...payload })
      },
    ),
  )
  const router = mount('/elements/example-id/edit')
  const user = userEvent.setup()
  const title = await screen.findByRole('textbox', {
    name: 'Title',
  })
  await user.clear(title)
  await user.type(title, 'Updated HTTP')
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/elements/example-id'),
  )
  expect(payload?.translations.map((item) => item.languageCode)).toEqual([
    'EN',
    'DE',
    'RU',
  ])
  expect(payload?.translations[0].title).toBe('Updated HTTP')
  expect(payload).not.toHaveProperty('images')
  expect(
    await screen.findByRole('heading', { name: 'Updated HTTP' }),
  ).toBeVisible()
})

test('validation prevents writes and server field errors keep the draft', async () => {
  let calls = 0
  server.use(
    http.put('http://localhost/api/elements/example-id', () => {
      calls++
      return HttpResponse.json({ code: 'duplicate_slug' }, { status: 409 })
    }),
  )
  mount('/elements/example-id/edit')
  const user = userEvent.setup()
  const slug = await screen.findByLabelText('Slug')
  await user.clear(slug)
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() => expect(slug).toHaveAttribute('aria-invalid', 'true'))
  expect(calls).toBe(0)
  await user.type(slug, 'duplicate')
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() => expect(calls).toBe(1))
  await waitFor(() => expect(slug).toHaveAttribute('aria-invalid', 'true'))
  expect(slug).toHaveValue('duplicate')
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('HTTP')
})

test('pending list reads expose loading before showing records', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.get('http://localhost/api/elements', async () => {
      await pending
      return HttpResponse.json(list)
    }),
  )
  mount()
  expect(screen.getByRole('status')).toHaveTextContent(/Loading/)
  release()
  expect(await screen.findByRole('table')).toBeVisible()
})

test('delete confirmation cancels without writing and removes the confirmed record', async () => {
  // jsdom does not implement native modal focus/inertness. Browser tests cover those.
  const prototype = HTMLDialogElement.prototype
  const originalShow = Object.getOwnPropertyDescriptor(prototype, 'showModal')
  const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close')
  Object.defineProperty(prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false
    },
  })
  try {
    let calls = 0
    server.use(
      http.get('http://localhost/api/elements', () =>
        HttpResponse.json(calls ? [] : list),
      ),
      http.delete('http://localhost/api/elements/example-id', () => {
        calls++
        return new HttpResponse(null, { status: 204 })
      }),
    )
    mount()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Delete: HTTP' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    )
    expect(calls).toBe(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete: HTTP' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('table')).not.toBeInTheDocument(),
    )
    expect(calls).toBe(1)
  } finally {
    if (originalShow)
      Object.defineProperty(prototype, 'showModal', originalShow)
    else Reflect.deleteProperty(prototype, 'showModal')
    if (originalClose) Object.defineProperty(prototype, 'close', originalClose)
    else Reflect.deleteProperty(prototype, 'close')
  }
})

test('create form prevents duplicate submission while the request is pending', async () => {
  let calls = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.post('http://localhost/api/elements', async ({ request }) => {
      calls++
      const body = (await request.json()) as ElementWriteRequest
      await pending
      return HttpResponse.json({ ...elementFixture, ...body }, { status: 201 })
    }),
  )
  const router = mount('/elements/new')
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Slug'), 'new-http')
  for (const label of ['English', 'Deutsch', 'Русский']) {
    await user.click(screen.getByRole('tab', { name: label }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), label)
    await user.type(
      screen.getByRole('textbox', {
        name: 'Explanation (Markdown)',
      }),
      'Content',
    )
  }
  const form = screen
    .getByRole('button', { name: 'Save definition' })
    .closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(calls).toBe(1))
  expect(screen.getByLabelText('Slug')).toBeDisabled()
  release()
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/elements/example-id'),
  )
  expect(calls).toBe(1)
})
