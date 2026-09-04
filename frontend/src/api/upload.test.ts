import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { createApiClient } from './client'

class FakeXhr {
  static latest: FakeXhr
  constructor() {
    FakeXhr.latest = this
  }
  status = 201
  responseText = '{"id":"image"}'
  timeout = 0
  upload = {
    onprogress: null as
      | ((event: {
          lengthComputable: boolean
          loaded: number
          total: number
        }) => void)
      | null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  open = vi.fn()
  setRequestHeader = vi.fn()
  send = vi.fn()
  abort = vi.fn(() => this.onabort?.())
}
beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr))
afterEach(() => vi.unstubAllGlobals())
const schema = z.object({ id: z.string() })
function start(signal?: AbortSignal) {
  const progress = vi.fn()
  const body = new FormData()
  const promise = createApiClient('/custom-api').upload(
    '/elements/one/images',
    schema,
    body,
    progress,
    signal,
  )
  return { promise, progress, body, xhr: FakeXhr.latest }
}
test('upload uses configured base and browser multipart boundary, reports progress, parses response', async () => {
  const { promise, progress, body, xhr } = start()
  expect(xhr.open).toHaveBeenCalledWith(
    'POST',
    'http://localhost/custom-api/elements/one/images',
  )
  expect(xhr.send).toHaveBeenCalledWith(body)
  expect(xhr.setRequestHeader).toHaveBeenCalledTimes(1)
  expect(xhr.setRequestHeader).toHaveBeenCalledWith(
    'Accept',
    'application/json, application/problem+json',
  )
  expect(xhr.timeout).toBe(120000)
  xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 })
  xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 0 })
  expect(progress.mock.calls).toEqual([[25], [null]])
  xhr.onload?.()
  await expect(promise).resolves.toEqual({ id: 'image' })
})
test.each([
  ['{"code":"duplicate_image_order"}', 409, 'duplicate_image_order'],
  ['not json', 413, 'http_error'],
  ['not json', 201, 'invalid_response'],
  ['{}', 201, 'invalid_response'],
])('upload parses error %s', async (body, status, code) => {
  const { promise, xhr } = start()
  xhr.responseText = String(body)
  xhr.status = Number(status)
  xhr.onload?.()
  await expect(promise).rejects.toMatchObject({ code, status })
})
test.each(['onerror', 'ontimeout'] as const)(
  'upload handles %s without retry',
  async (event) => {
    const { promise, xhr } = start()
    xhr[event]?.()
    await expect(promise).rejects.toMatchObject({
      code: 'network_error',
      status: null,
    })
    expect(xhr.send).toHaveBeenCalledTimes(1)
  },
)
test('upload aborts on signal and removes its listener after completion', async () => {
  const abort = new AbortController()
  const { promise, xhr } = start(abort.signal)
  abort.abort()
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  expect(xhr.abort).toHaveBeenCalledTimes(1)
  const other = new AbortController()
  const successful = start(other.signal)
  successful.xhr.onload?.()
  await successful.promise
  other.abort()
  expect(successful.xhr.abort).not.toHaveBeenCalled()
})
test('already aborted signals never send', async () => {
  const abort = new AbortController()
  abort.abort()
  const { promise, xhr } = start(abort.signal)
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  expect(xhr.send).not.toHaveBeenCalled()
})
