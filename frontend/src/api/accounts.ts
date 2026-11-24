import { z } from 'zod'
import { createApiClient } from './client'

const roleSchema = z.enum(['USER', 'ADMIN'])
export type AccountRole = z.infer<typeof roleSchema>

const accountSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  role: roleSchema,
  status: z.enum(['ACCEPTED', 'CONFIRMED', 'DISABLED']),
  createdAt: z.string().min(1),
})
export type AccountSummary = z.infer<typeof accountSchema>

const invitationSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  role: roleSchema,
  expiresAt: z.string().min(1),
  link: z.string().url(),
})
export type CreatedInvitation = z.infer<typeof invitationSchema>

export function createAccountsApi(client = createApiClient()) {
  return {
    list: (signal?: AbortSignal) =>
      client.request('/admin/accounts', z.array(accountSchema), { signal }),
    invite: (email: string, role: AccountRole) =>
      client.request('/admin/invitations', invitationSchema, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    confirm: (id: string) =>
      client.request(
        `/admin/accounts/${encodeURIComponent(id)}/confirm`,
        z.undefined(),
        { method: 'POST' },
      ),
    acceptInvitation: (token: string, password: string) =>
      client.request('/invitations/accept', z.undefined(), {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  }
}
