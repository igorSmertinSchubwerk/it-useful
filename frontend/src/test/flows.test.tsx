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
function mount(path = '/it-definitions') {
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
  const router = mount('/it-definitions/example-id/edit')
  const user = userEvent.setup()
  const title = await screen.findByRole('textbox', { name: 'Title' })
  await user.clear(title)
  await user.type(title, 'Updated HTTP')
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/it-definitions/example-id'),
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

test('validation prevents writes and a taken slug keeps the draft', async () => {
  let calls = 0
  server.use(
    http.put('http://localhost/api/elements/example-id', () => {
      calls++
      return HttpResponse.json({ code: 'duplicate_slug' }, { status: 409 })
    }),
  )
  mount('/it-definitions/example-id/edit')
  const user = userEvent.setup()
  const title = await screen.findByRole('textbox', { name: 'Title' })
  expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument()
  await user.clear(title)
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'))
  expect(calls).toBe(0)
  await user.type(title, 'Taken')
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() => expect(calls).toBe(1))
  await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'))
  expect(title).toHaveAccessibleDescription(
    'Another definition already uses this title.',
  )
  expect(title).toHaveValue('Taken')
})

test('a title another definition uses warns at once and blocks saving', async () => {
  let calls = 0
  server.use(
    http.get('http://localhost/api/elements', () => HttpResponse.json(list)),
    http.post('http://localhost/api/elements', () => {
      calls++
      return HttpResponse.json(elementFixture, { status: 201 })
    }),
  )
  mount('/it-definitions/new')
  const user = userEvent.setup()
  for (const label of ['Русский', 'Deutsch', 'English']) {
    await user.click(screen.getByRole('tab', { name: label }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), label)
    await user.click(screen.getByRole('textbox', { name: 'Explanation' }))
    await user.paste('Content')
  }
  const title = screen.getByRole('textbox', { name: 'Title' })
  await user.clear(title)
  await user.type(title, ' http')
  await waitFor(() =>
    expect(title).toHaveAccessibleDescription(
      'Another definition already uses this title.',
    ),
  )
  expect(title).toHaveAttribute('aria-invalid', 'true')
  expect(
    screen.getByRole('tab', { name: 'English — has errors' }),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  // Saving moves the focus back to the title that is taken.
  await waitFor(() => expect(title).toHaveFocus())
  expect(calls).toBe(0)
  await user.type(title, ' 2')
  await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'false'))
})

test('an imported file fills every language and saves with a slug from the English title', async () => {
  let payload: ElementWriteRequest | undefined
  server.use(
    http.post('http://localhost/api/elements', async ({ request }) => {
      payload = (await request.json()) as ElementWriteRequest
      return HttpResponse.json(
        { ...elementFixture, ...payload },
        { status: 201 },
      )
    }),
  )
  const router = mount('/it-definitions/new')
  const user = userEvent.setup()
  const translations = {
    en: {
      title: 'Load Balancer',
      explanation: 'Spreads **load**.',
      examples: 'nginx',
    },
    de: { title: 'Lastverteiler', explanation: 'Verteilt Last.' },
    ru: { title: 'Балансировщик', explanation: 'Распределяет нагрузку.' },
  }
  await user.upload(
    screen.getByLabelText('Import from file'),
    new File([JSON.stringify(translations)], 'lb.json', {
      type: 'application/json',
    }),
  )
  expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
    'Load Balancer',
  )
  expect(
    screen
      .getByRole('textbox', { name: 'Explanation' })
      .querySelector('strong'),
  ).toHaveTextContent('load')
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/it-definitions/example-id'),
  )
  expect(payload).toEqual({
    slug: 'load-balancer',
    translations: [
      {
        languageCode: 'EN',
        title: 'Load Balancer',
        content: 'Spreads **load**.',
        examples: 'nginx',
      },
      {
        languageCode: 'DE',
        title: 'Lastverteiler',
        content: 'Verteilt Last.',
        examples: '',
      },
      {
        languageCode: 'RU',
        title: 'Балансировщик',
        content: 'Распределяет нагрузку.',
        examples: '',
      },
    ],
  })
})

test('an unreadable import file reports an error and changes nothing', async () => {
  mount('/it-definitions/new')
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText('Import from file'),
    new File(['{"en": '], 'broken.json', { type: 'application/json' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This file could not be read.',
  )
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('')
})

test('a new definition keeps at most five images and uploads them after saving', async () => {
  // jsdom cannot hand a multipart body to the mock server, so this counts the
  // uploads. The browser tests check which files are sent and in which order.
  let uploads = 0
  server.use(
    http.post('http://localhost/api/elements', async ({ request }) =>
      HttpResponse.json(
        { ...elementFixture, ...((await request.json()) as object) },
        { status: 201 },
      ),
    ),
    http.post('http://localhost/api/elements/example-id/images', () => {
      uploads++
      return HttpResponse.json(
        {
          id: `image-${uploads}`,
          fileName: 'p.png',
          contentType: 'image/png',
          altText: null,
          displayOrder: uploads - 1,
          createdAt: elementFixture.createdAt,
        },
        { status: 201 },
      )
    }),
  )
  const router = mount('/it-definitions/new')
  const user = userEvent.setup()
  const picture = (index: number) =>
    new File(['x'], `p${index}.png`, { type: 'image/png' })
  await user.upload(
    screen.getByLabelText('Add images'),
    [1, 2, 3, 4, 5, 6].map(picture),
  )
  expect(await screen.findAllByRole('img')).toHaveLength(5)
  expect(screen.getByRole('alert')).toHaveTextContent('Only 5 images fit.')
  await user.click(screen.getByRole('button', { name: 'Remove image: p2.png' }))
  expect(screen.getAllByRole('img')).toHaveLength(4)
  for (const label of ['English', 'Deutsch', 'Русский']) {
    await user.click(screen.getByRole('tab', { name: label }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), label)
    await user.click(screen.getByRole('textbox', { name: 'Explanation' }))
    await user.paste('Content')
  }
  await user.click(screen.getByRole('button', { name: 'Save definition' }))
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/it-definitions/example-id'),
  )
  expect(uploads).toBe(4)
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
  const router = mount('/it-definitions/new')
  const user = userEvent.setup()
  for (const label of ['English', 'Deutsch', 'Русский']) {
    await user.click(screen.getByRole('tab', { name: label }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), label)
    await user.click(screen.getByRole('textbox', { name: 'Explanation' }))
    await user.paste('Content')
  }
  const form = screen
    .getByRole('button', { name: 'Save definition' })
    .closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(calls).toBe(1))
  expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled()
  release()
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/it-definitions/example-id'),
  )
  expect(calls).toBe(1)
})

test.each([
  [4, false],
  [5, true],
])(
  'editing a definition with %i images has the image picker disabled: %s',
  async (count, full) => {
    const images = Array.from({ length: count }, (_, index) => ({
      id: `image-${index}`,
      fileName: `p${index}.png`,
      contentType: 'image/png',
      altText: null,
      displayOrder: index,
      createdAt: elementFixture.createdAt,
    }))
    server.use(
      http.get('http://localhost/api/elements/example-id', () =>
        HttpResponse.json({ ...elementFixture, images }),
      ),
    )
    mount('/it-definitions/example-id/edit')
    const picker = await screen.findByLabelText('Choose image')
    expect(screen.getAllByRole('img')).toHaveLength(count)
    if (full) expect(picker).toBeDisabled()
    else expect(picker).toBeEnabled()
  },
)
