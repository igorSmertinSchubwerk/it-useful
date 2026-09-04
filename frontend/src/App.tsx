import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AppRoutes } from './routes/AppRoutes'
import { I18nProvider } from './i18n/I18nProvider'

export default function App() {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AppRoutes />
      </I18nProvider>
    </QueryClientProvider>
  )
}
