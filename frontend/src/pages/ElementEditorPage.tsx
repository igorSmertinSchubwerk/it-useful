import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ElementForm } from '../features/elements/ElementForm'
import { elementsApi, elementKeys } from '../features/elements/queries'
import { useI18n } from '../i18n/context'
import { localizeApiError } from '../i18n/errors'

function EditLoader({ id }: { id: string }) {
  const { t, language } = useI18n()
  // Separate edit snapshot: focus/reconnect refetches must not reset a draft.
  const query = useQuery({
    queryKey: [...elementKeys.all, 'edit', id],
    queryFn: ({ signal }) => elementsApi.get(id, signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  if (query.isPending) return <p role="status">{t.detailLoading}</p>
  if (query.isError)
    return (
      <div className="space-y-4">
        <p role="alert">{localizeApiError(query.error, language).message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="text-brand underline"
        >
          {t.retry}
        </button>
        <Link to="/" className="ml-4 text-brand underline">
          {t.back}
        </Link>
      </div>
    )
  return <ElementForm key={id} element={query.data} />
}

export function ElementEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { t } = useI18n()
  return (
    <article className="min-w-0 space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold">
        {mode === 'create' ? t.create : t.edit}
      </h1>
      {mode === 'create' ? (
        <ElementForm key={`new:${params.get('language') ?? 'EN'}`} />
      ) : (
        <EditLoader key={id} id={id} />
      )}
    </article>
  )
}
