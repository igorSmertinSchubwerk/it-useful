import { LanguageSelector } from '../components/LanguageSelector'
import { AccountsCard } from '../features/accounts/AccountsCard'
import { ChangePasswordCard } from '../features/accounts/ChangePasswordCard'
import { useAuthentication } from '../features/auth/context'
import { useI18n } from '../i18n/context'

export function SettingsPage() {
  const { t } = useI18n()
  const { state } = useAuthentication()
  const server = state.status === 'signedIn' && !state.local
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-bold">{t.settings}</h1>
      <section
        aria-labelledby="settings-general"
        className="rounded-xl border border-line bg-surface p-6"
      >
        <h2 id="settings-general" className="mb-4 text-xl font-bold">
          {t.general}
        </h2>
        <LanguageSelector />
      </section>
      {server && state.role === 'ADMIN' && <AccountsCard />}
      {server && <ChangePasswordCard />}
    </div>
  )
}
