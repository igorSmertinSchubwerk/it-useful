import { lazy, Suspense, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cardClass } from '../features/elements/formStyles'
import { elementsApi, elementKeys } from '../features/elements/queries'
import { useI18n } from '../i18n/context'
import { localizeApiError } from '../i18n/errors'
import { definitionsPath } from '../utils/paths'

// The form carries the text editor, the largest part of the app. Only people
// who create or edit a definition download it.
const ElementForm = lazy(() =>
  import('../features/elements/ElementForm').then((module) => ({
    default: module.ElementForm,
  })),
)

function EditLoader({
  id,
  headerSlot,
}: {
  id: string
  headerSlot: HTMLElement | null
}) {
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
      <div className={`${cardClass} space-y-4`}>
        <p role="alert">{localizeApiError(query.error, language).message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="text-brand underline"
        >
          {t.retry}
        </button>
        <Link to={definitionsPath} className="ml-4 text-brand underline">
          {t.back}
        </Link>
      </div>
    )
  return <ElementForm key={id} element={query.data} headerSlot={headerSlot} />
}

export function ElementEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { t } = useI18n()
  // The title stays mounted while the definition loads, so it keeps the focus
  // the route change gave it. The form adds its controls to the slot beside it.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  return (
    <div className="min-w-0 space-y-5">
      <div
        className={`${cardClass} flex flex-wrap items-center gap-x-4 gap-y-3`}
      >
        <h1 className="mr-auto text-3xl font-bold">
          {mode === 'create' ? t.create : t.edit}
        </h1>
        <div ref={setHeaderSlot} className="contents" />
      </div>
      <Suspense fallback={<p role="status">{t.detailLoading}</p>}>
        {mode === 'create' ? (
          <ElementForm
            key={`new:${params.get('language') ?? 'EN'}`}
            headerSlot={headerSlot}
          />
        ) : (
          <EditLoader key={id} id={id} headerSlot={headerSlot} />
        )}
      </Suspense>
    </div>
  )
}
