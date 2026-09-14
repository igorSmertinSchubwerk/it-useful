import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AppRoutes } from './routes/AppRoutes'
import { I18nProvider } from './i18n/I18nProvider'
import { AuthProvider } from './features/auth/AuthProvider'

export default function App({
  authenticationEnabled,
}: {
  authenticationEnabled?: boolean
}) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider enabled={authenticationEnabled}>
          <AppRoutes />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
