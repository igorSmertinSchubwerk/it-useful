import { z } from 'zod'
import { createApiClient } from './client'

const csrfSchema = z.object({
  headerName: z.string().min(1),
  token: z.string().min(1),
})

const sessionSchema = z.object({
  email: z.string().min(1),
  role: z.enum(['USER', 'ADMIN']),
  status: z.enum(['ACCEPTED', 'CONFIRMED', 'DISABLED']),
  csrf: csrfSchema,
})

export type AccountSession = z.infer<typeof sessionSchema>

export function createSessionApi(client = createApiClient()) {
  return {
    get: (signal?: AbortSignal) =>
      client.request('/session', sessionSchema, { signal }),
    csrf: () => client.request('/session/csrf', csrfSchema),
    signIn: (email: string, password: string) =>
      client.request('/session/login', z.undefined(), {
        method: 'POST',
        body: new URLSearchParams({ email, password }),
      }),
    logout: (signal?: AbortSignal) =>
      client.requestFromOrigin('/logout', z.undefined(), {
        method: 'POST',
        signal,
      }),
  }
}
