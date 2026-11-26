import { z } from 'zod'
import { ApiError, httpError } from './errors'
import {
  applyCsrfToken,
  notifyAuthenticationRequired,
  setCsrfToken,
} from './authSession'

const sessionCsrfSchema = z.object({
  csrf: z.object({ headerName: z.string().min(1), token: z.string().min(1) }),
})

function decodeResponse<T>(
  status: number,
  text: string,
  schema: z.ZodType<T>,
): T {
  if (status === 401) notifyAuthenticationRequired()
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
  if (status < 200 || status >= 300) {
    throw httpError(status, body)
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    throw new ApiError(
      'The API response does not match the expected format.',
      status,
      'invalid_response',
    )
  return parsed.data
}

const restoring = new Map<string, Promise<boolean>>()

async function fetchSessionCsrf(sessionUrl: string) {
  try {
    const response = await fetch(sessionUrl, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return false
    const csrf = sessionCsrfSchema.safeParse(await response.json())
    if (!csrf.success) return false
    setCsrfToken(csrf.data.csrf.headerName, csrf.data.csrf.token)
    return true
  } catch {
    return false
  }
}

function untilAborted(signal?: AbortSignal | null) {
  return new Promise<never>((_resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
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

  function originUrl(path: string): string {
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      path.includes('\\') ||
      path.split('/').some((part) => part === '..' || part === '.')
    ) {
      throw new Error('Expected an origin-relative endpoint path')
    }
    return new URL(path, window.location.origin).href
  }

  // Writes that fail together share one restore, so they all end up with the
  // token of the same new session. Each caller can still abort its own wait.
  function restoreCsrfToken(signal?: AbortSignal | null): Promise<boolean> {
    const sessionUrl = url('/session')
    let shared = restoring.get(sessionUrl)
    if (!shared) {
      shared = fetchSessionCsrf(sessionUrl).finally(() =>
        restoring.delete(sessionUrl),
      )
      restoring.set(sessionUrl, shared)
    }
    return Promise.race([shared, untilAborted(signal)])
  }

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestInit = {},
    endpointUrl = url,
  ): Promise<T> {
    const endpoint = endpointUrl(path)
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json, application/problem+json')
    if (
      options.body instanceof FormData ||
      options.body instanceof URLSearchParams
    )
      headers.delete('Content-Type')
    else if (options.body != null)
      headers.set('Content-Type', 'application/json')
    const csrfProtected =
      options.method != null &&
      !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase()) &&
      new URL(endpoint).origin === window.location.origin
    if (csrfProtected) applyCsrfToken(headers)
    let response: Response
    let text: string
    try {
      response = await fetch(endpoint, { ...options, headers })
      // A 30-day login restores a new server session, so the CSRF token held
      // in memory no longer matches. Fetch the current one and retry once.
      if (
        response.status === 401 &&
        csrfProtected &&
        !path.startsWith('/session') &&
        (await restoreCsrfToken(options.signal))
      ) {
        applyCsrfToken(headers)
        response = await fetch(endpoint, { ...options, headers })
      }
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
    retried = false,
  ): Promise<T> {
    const endpoint = url(path)
    const sameOrigin = new URL(endpoint).origin === window.location.origin
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
      const settle = () => {
        try {
          resolve(decodeResponse(xhr.status, xhr.responseText, schema))
        } catch (error) {
          reject(error)
        }
      }
      xhr.onload = () => {
        cleanup()
        // Same stale-token case as request(): retry once after a 30-day login.
        if (xhr.status !== 401 || retried || !sameOrigin) return settle()
        restoreCsrfToken(signal).then(
          (restored) =>
            restored
              ? resolve(upload(path, schema, body, onProgress, signal, true))
              : settle(),
          (error: unknown) => (signal?.aborted ? reject(error) : settle()),
        )
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
        if (sameOrigin) {
          const csrfHeaders = new Headers()
          applyCsrfToken(csrfHeaders)
          csrfHeaders.forEach((value, name) =>
            xhr.setRequestHeader(name, value),
          )
        }
        xhr.send(body)
      } catch {
        fail(new ApiError('Unable to start upload.', null, 'network_error'))
      }
    })
  }

  const requestFromOrigin = <T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestInit = {},
  ) => request(path, schema, options, originUrl)

  return { request, requestFromOrigin, url, upload }
}
