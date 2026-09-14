import { z } from 'zod'
import { createApiClient } from './client'

const sessionSchema = z.object({
  authenticated: z.literal(true),
  role: z.literal('OWNER'),
  login: z.string().min(1),
  csrf: z.object({
    headerName: z.string().min(1),
    token: z.string().min(1),
  }),
})

export type OwnerSession = z.infer<typeof sessionSchema>

export function createSessionApi(client = createApiClient()) {
  return {
    get: (signal?: AbortSignal) =>
      client.request('/session', sessionSchema, { signal }),
    logout: (signal?: AbortSignal) =>
      client.requestFromOrigin('/logout', z.undefined(), {
        method: 'POST',
        signal,
      }),
  }
}
