import { createAccountsApi } from '../../api/accounts'

// Shared by the accounts page and the dashboard so both read one cache entry.
export const accountsApi = createAccountsApi()
export const adminKey = ['admin'] as const
export const accountsKey = ['admin', 'accounts'] as const
export const invitationsKey = ['admin', 'invitations'] as const
