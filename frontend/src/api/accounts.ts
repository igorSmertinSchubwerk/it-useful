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
  emailSent: z.boolean().default(false),
})
export type CreatedInvitation = z.infer<typeof invitationSchema>

const openInvitationSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  role: roleSchema,
  expiresAt: z.string().min(1),
})
export type OpenInvitation = z.infer<typeof openInvitationSchema>

const passwordResetSchema = z.object({
  id: z.string().min(1),
  expiresAt: z.string().min(1),
  link: z.string().url(),
  emailSent: z.boolean().default(false),
})
export type CreatedPasswordReset = z.infer<typeof passwordResetSchema>

export function createAccountsApi(client = createApiClient()) {
  const account = (id: string, action: string) =>
    `/admin/accounts/${encodeURIComponent(id)}/${action}`
  return {
    list: (signal?: AbortSignal) =>
      client.request('/admin/accounts', z.array(accountSchema), { signal }),
    invite: (email: string, role: AccountRole) =>
      client.request('/admin/invitations', invitationSchema, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    confirm: (id: string) =>
      client.request(account(id, 'confirm'), z.undefined(), { method: 'POST' }),
    changeRole: (id: string, role: AccountRole) =>
      client.request(account(id, 'role'), z.undefined(), {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    disable: (id: string) =>
      client.request(account(id, 'disable'), z.undefined(), { method: 'POST' }),
    enable: (id: string) =>
      client.request(account(id, 'enable'), z.undefined(), { method: 'POST' }),
    createPasswordReset: (id: string) =>
      client.request(account(id, 'password-resets'), passwordResetSchema, {
        method: 'POST',
      }),
    listInvitations: (signal?: AbortSignal) =>
      client.request('/admin/invitations', z.array(openInvitationSchema), {
        signal,
      }),
    revokeInvitation: (id: string) =>
      client.request(
        `/admin/invitations/${encodeURIComponent(id)}`,
        z.undefined(),
        { method: 'DELETE' },
      ),
    completePasswordReset: (token: string, password: string) =>
      client.request('/password-resets/complete', z.undefined(), {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    changeOwnPassword: (currentPassword: string, newPassword: string) =>
      client.request('/session/password', z.undefined(), {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    acceptInvitation: (token: string, password: string) =>
      client.request('/invitations/accept', z.undefined(), {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  }
}
