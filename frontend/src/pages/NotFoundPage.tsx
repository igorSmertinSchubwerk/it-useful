import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/context'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <section className="rounded-xl border border-line bg-surface p-8">
      <h1 className="text-3xl font-bold">{t.notFound}</h1>
      <p className="mt-4 text-muted">{t.notFoundText}</p>
      <Link to="/" className="mt-6 inline-block text-brand underline">
        {t.back}
      </Link>
    </section>
  )
}
