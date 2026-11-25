import { LanguageSelector } from '../components/LanguageSelector'
import { useI18n } from '../i18n/context'

export function SettingsPage() {
  const { t } = useI18n()
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
    </div>
  )
}
