// @vitest-environment node
// Keep Fetch, File, and FormData in the same native runtime for multipart tests.
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { server } from '../test/server'
import { createApiClient, normalizeBaseUrl } from './client'
import { createElementsApi } from './elements'

const base = 'http://localhost/api'
const client = createApiClient(base)
const api = createElementsApi(client)
beforeAll(() =>
  vi.stubGlobal('window', { location: { origin: 'http://localhost' } }),
)
afterAll(() => vi.unstubAllGlobals())
const image = {
  id: 'image-id',
  fileName: 'test.png',
  contentType: 'image/png',
  altText: null,
  displayOrder: 0,
  createdAt: '2026-09-04T00:00:00Z',
}
const detail = {
  id: 'element-id',
  slug: 'http',
  translations: [
    { languageCode: 'EN', title: 'HTTP', content: 'Protocol', examples: null },
  ],
  images: [image],
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
}

test('lists and reads typed responses including nullable fields', async () => {
  const list = [
    {
      id: detail.id,
      slug: detail.slug,
      titles: { EN: 'HTTP', DE: 'HTTP', RU: 'HTTP' },
      updatedAt: detail.updatedAt,
    },
  ]
  server.use(
    http.get(`${base}/elements`, () => HttpResponse.json(list)),
    http.get(`${base}/elements/element-id`, () => HttpResponse.json(detail)),
  )
  expect(await api.list()).toEqual(list)
  expect(await api.get('element-id')).toEqual(detail)
})

test.each(['POST', 'PUT'] as const)('sends JSON with %s', async (method) => {
  const body = {
    slug: 'http',
    translations: [
      {
        languageCode: 'EN' as const,
        title: 'HTTP',
        content: 'Protocol',
        examples: null,
      },
    ],
  }
  let received: unknown
  let contentType: string | null = null
  server.use(
    http.all(
      `${base}/elements${method === 'PUT' ? '/element-id' : ''}`,
      async ({ request }) => {
        expect(request.method).toBe(method)
        contentType = request.headers.get('Content-Type')
        received = await request.json()
        return HttpResponse.json(detail, {
          status: method === 'POST' ? 201 : 200,
        })
      },
    ),
  )
  expect(
    await (method === 'POST'
      ? api.create(body)
      : api.update('element-id', body)),
  ).toEqual(detail)
  expect(received).toEqual(body)
  expect(contentType).toBe('application/json')
})

test.each(['element', 'image'])(
  'handles empty 204 when deleting an %s',
  async (kind) => {
    server.use(
      http.delete(
        `${base}/${kind === 'element' ? 'elements' : 'images'}/id`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    expect(
      await (kind === 'element' ? api.remove('id') : api.removeImage('id')),
    ).toBeUndefined()
  },
)

test('patches image metadata including explicit null alternative text', async () => {
  let received: unknown
  server.use(
    http.patch(`${base}/images/image-id`, async ({ request }) => {
      received = await request.json()
      return HttpResponse.json(image)
    }),
  )
  expect(
    await api.updateImage('image-id', { altText: null, displayOrder: 0 }),
  ).toEqual(image)
  expect(received).toEqual({ altText: null, displayOrder: 0 })
})

test.each([true, false])(
  'uploads multipart file with optional metadata: %s',
  async (metadata) => {
    let fields: FormData | undefined
    let contentType: string | null = null
    server.use(
      http.post(`${base}/elements/element-id/images`, async ({ request }) => {
        contentType = request.headers.get('Content-Type')
        fields = await request.formData()
        return HttpResponse.json(image, { status: 201 })
      }),
    )
    expect(
      await api.uploadImage('element-id', {
        file: new File(['image bytes'], 'test.png', { type: 'image/png' }),
        ...(metadata ? { altText: '', displayOrder: 0 } : {}),
      }),
    ).toEqual(image)
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/)
    const file = fields?.get('file') as File
    expect(file.name).toBe('test.png')
    expect(file.size).toBe(11)
    expect(file.type).toBe('image/png')
    expect(fields?.get('altText')).toBe(metadata ? '' : null)
    expect(fields?.get('displayOrder')).toBe(metadata ? '0' : null)
  },
)

test.each([
  [400, 'validation_failed'],
  [404, 'element_not_found'],
  [409, 'duplicate_slug'],
  [413, 'upload_too_large'],
  [500, 'internal_error'],
])('preserves HTTP %s and backend error code', async (status, code) => {
  server.use(
    http.get(`${base}/elements`, () =>
      HttpResponse.json(
        {
          status: 999,
          detail: 'Request rejected',
          code,
          errors: [
            { field: 'translations[0].title', message: 'must not be blank' },
            { field: 3 },
          ],
        },
        { status: status as number },
      ),
    ),
  )
  await expect(api.list()).rejects.toMatchObject({
    name: 'ApiError',
    status,
    code,
    message: 'Request rejected',
    fieldErrors: [
      { field: 'translations[0].title', message: 'must not be blank' },
    ],
  })
})

test.each(['<html>Proxy error</html>', '', 'null', '{broken'])(
  'handles non-problem HTTP error body: %s',
  async (body) => {
    server.use(
      http.get(
        `${base}/elements`,
        () => new HttpResponse(body, { status: 502 }),
      ),
    )
    await expect(api.list()).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
      message: 'Request failed (HTTP 502)',
      fieldErrors: [],
    })
  },
)

test.each(['<html>SPA fallback</html>', '{}', '', '[{"id": 1}]'])(
  'rejects malformed successful response: %s',
  async (body) => {
    server.use(http.get(`${base}/elements`, () => new HttpResponse(body)))
    await expect(api.list()).rejects.toMatchObject({
      status: 200,
      code: 'invalid_response',
    })
  },
)

test('normalizes a network failure without pretending it is an HTTP status', async () => {
  server.use(http.get(`${base}/elements`, () => HttpResponse.error()))
  await expect(api.list()).rejects.toMatchObject({
    status: null,
    code: 'network_error',
  })
})

test('preserves cancellation instead of showing a network error', async () => {
  server.use(http.get(`${base}/elements`, () => HttpResponse.json([])))
  const controller = new AbortController()
  controller.abort()
  await expect(api.list(controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  })
})

test('joins base URLs consistently for JSON requests and image links', async () => {
  expect(normalizeBaseUrl(' /api/ ')).toBe('/api')
  const custom = createApiClient('https://api.example.test/service/api/')
  expect(createElementsApi(custom).imageUrl('a/b ?')).toBe(
    'https://api.example.test/service/api/images/a%2Fb%20%3F',
  )
  expect(createApiClient('/api').url('/elements')).toBe(
    `${window.location.origin}/api/elements`,
  )
  server.use(
    http.get('https://api.example.test/service/api/elements', () =>
      HttpResponse.json([]),
    ),
  )
  expect(await custom.request('/elements', z.array(z.unknown()))).toEqual([])
})

test.each([
  '',
  '//other.test/api',
  'ftp://other.test/api',
  'https://user:pass@other.test/api',
  '/api?token=x',
  '/api#fragment',
  'api',
])('rejects invalid base %s', (baseUrl) => {
  expect(() => createApiClient(baseUrl)).toThrow()
})

test('reads the configured environment base and uses /api when unset', () => {
  try {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api/')
    expect(createApiClient().url('/elements')).toBe(
      'https://api.example.test/api/elements',
    )
    vi.stubEnv('VITE_API_BASE_URL', undefined)
    expect(createApiClient().url('/elements')).toBe(
      'http://localhost/api/elements',
    )
  } finally {
    vi.unstubAllEnvs()
  }
})
