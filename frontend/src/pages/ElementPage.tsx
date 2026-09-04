import { Link, useParams, useSearchParams } from 'react-router-dom'
import { elementPath } from '../utils/paths'
import { useI18n } from '../i18n/context'

export function ElementPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const suffix = params.size ? `?${params.toString()}` : ''
  const { t } = useI18n()
  return (
    <article className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <p className="text-sm font-semibold text-muted">{t.preview}</p>
      <h1 className="mt-3 text-3xl font-bold">{t[mode]}</h1>
      {id && (
        <p className="mt-4 break-all text-muted">
          {t.requestedId} {id}
        </p>
      )}
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        {mode === 'create' ? t.createPlaceholder : t.editPlaceholder}
      </p>
      <div className="mt-6 flex flex-wrap gap-5">
        <Link to={`/${suffix}`} className="text-brand underline">
          {t.back}
        </Link>
        {id && (
          <Link
            to={`${elementPath(id)}${suffix}`}
            className="text-brand underline"
          >
            {t.detailPreview}
          </Link>
        )}
      </div>
    </article>
  )
}
