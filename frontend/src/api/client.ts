import { z } from 'zod'
import { ApiError, httpError } from './errors'

function decodeResponse<T>(
  status: number,
  text: string,
  schema: z.ZodType<T>,
): T {
  let body: unknown
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    if (status < 200 || status >= 300) throw httpError(status, undefined)
    throw new ApiError(
      'The API returned invalid JSON.',
      status,
      'invalid_response',
    )
  }
  if (status < 200 || status >= 300) throw httpError(status, body)
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    throw new ApiError(
      'The API response does not match the expected format.',
      status,
      'invalid_response',
    )
  return parsed.data
}

export function normalizeBaseUrl(value: string): string {
  const base = value.trim().replace(/\/+$/, '')
  const relative = base.startsWith('/') && !base.startsWith('//')
  const url = new URL(base, 'http://local.invalid')
  if (
    !base ||
    (!relative && !/^https?:\/\//i.test(base)) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    base.includes('\\')
  ) {
    throw new Error(
      'VITE_API_BASE_URL must be a root-relative path or HTTP(S) URL without credentials, query, or fragment',
    )
  }
  return base
}

export function createApiClient(
  baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api',
) {
  const base = normalizeBaseUrl(baseUrl)
  function url(path: string): string {
    // Paths are internal endpoint paths, never arbitrary external URLs.
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      path.includes('\\') ||
      path.split('/').some((part) => part === '..' || part === '.')
    ) {
      throw new Error('Expected an API-relative endpoint path')
    }
    return new URL(`${base}${path}`, window.location.origin).href
  }

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json, application/problem+json')
    if (options.body instanceof FormData) headers.delete('Content-Type')
    else if (options.body != null)
      headers.set('Content-Type', 'application/json')
    let response: Response
    let text: string
    const endpoint = url(path)
    try {
      response = await fetch(endpoint, { ...options, headers })
      text = await response.text()
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      )
        throw error
      throw new ApiError(
        'Unable to reach the API. Check your connection and backend.',
        null,
        'network_error',
      )
    }
    return decodeResponse(response.status, text, schema)
  }

  // Fetch does not expose upload progress. XHR shares URL/error/schema handling.
  function upload<T>(
    path: string,
    schema: z.ZodType<T>,
    body: FormData,
    onProgress: (percent: number | null) => void,
    signal?: AbortSignal,
  ): Promise<T> {
    const endpoint = url(path)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const cleanup = () => signal?.removeEventListener('abort', abort)
      const fail = (error: unknown) => {
        cleanup()
        reject(error)
      }
      const abort = () => {
        xhr.abort()
        fail(new DOMException('Upload aborted', 'AbortError'))
      }
      if (signal?.aborted) {
        abort()
        return
      }
      xhr.upload.onprogress = (event) =>
        onProgress(
          event.lengthComputable && event.total > 0
            ? Math.min(100, Math.round((event.loaded / event.total) * 100))
            : null,
        )
      xhr.onload = () => {
        cleanup()
        try {
          resolve(decodeResponse(xhr.status, xhr.responseText, schema))
        } catch (error) {
          reject(error)
        }
      }
      xhr.onerror = xhr.ontimeout = () =>
        fail(
          new ApiError(
            'Unable to confirm the upload result.',
            null,
            'network_error',
          ),
        )
      xhr.onabort = () => fail(new DOMException('Upload aborted', 'AbortError'))
      signal?.addEventListener('abort', abort, { once: true })
      try {
        xhr.open('POST', endpoint)
        xhr.timeout = 120_000
        xhr.setRequestHeader(
          'Accept',
          'application/json, application/problem+json',
        )
        xhr.send(body)
      } catch {
        fail(new ApiError('Unable to start upload.', null, 'network_error'))
      }
    })
  }

  return { request, url, upload }
}
