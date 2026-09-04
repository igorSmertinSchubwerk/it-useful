import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/errors'
import { useElement } from '../features/elements/queries'
import { parseContentLanguage } from '../features/elements/list'
import { SafeMarkdown } from '../features/elements/SafeMarkdown'
import { DetailImage } from '../features/elements/DetailImage'
import { useI18n } from '../i18n/context'
import { localizeApiError } from '../i18n/errors'
import { elementPath } from '../utils/paths'

export function ElementDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const contentLanguage = parseContentLanguage(params.get('language'))
  const { t, language } = useI18n()
  const query = useElement(id)
  const missing = query.error instanceof ApiError && query.error.status === 404
  // Do not display cached content after the server confirms deletion.
  const element = missing ? undefined : query.data
  const translation = element?.translations.find(
    (entry) => entry.languageCode === contentLanguage,
  )
  const suffix = params.size ? `?${params.toString()}` : ''
  return (
    <article className="min-w-0 space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold">{t.detail}</h1>
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <label
            htmlFor="content-language"
            className="block text-sm font-semibold"
          >
            {t.contentLanguage}
          </label>
          <select
            id="content-language"
            value={contentLanguage}
            className="mt-1 rounded border border-line bg-surface p-2"
            onChange={(event) =>
              setParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('language', event.target.value)
                return next
              })
            }
          >
            <option value="EN" lang="en">
              English
            </option>
            <option value="DE" lang="de">
              Deutsch
            </option>
            <option value="RU" lang="ru">
              Русский
            </option>
          </select>
        </div>
        <Link to={`/${suffix}`} className="text-brand underline">
          {t.back}
        </Link>
        {element && (
          <Link
            to={`${elementPath(id, true)}${suffix}`}
            className="text-brand underline"
          >
            {t.editPreview}
          </Link>
        )}
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          className="text-brand underline disabled:opacity-50"
        >
          {query.isError ? t.retry : t.refresh}
        </button>
      </div>
      <p role="status">
        {query.isPending
          ? t.detailLoading
          : query.isFetching
            ? t.refreshing
            : ''}
      </p>
      {query.isError && (
        <p role="alert">
          {missing
            ? t.definitionMissing
            : `${element ? `${t.detailStale} ` : ''}${localizeApiError(query.error, language).message}`}
        </p>
      )}
      {element && (
        <>
          <p className="break-all text-sm text-muted">{element.slug}</p>
          <h2
            className="break-words text-2xl font-bold"
            lang={
              translation?.title.trim()
                ? contentLanguage.toLowerCase()
                : language
            }
          >
            {translation?.title.trim() || t.missingTitle}
          </h2>
          {!translation && <p role="status">{t.translationMissing}</p>}
          {translation && (
            <>
              <section aria-label={t.explanationHeading}>
                {translation.content.trim() ? (
                  <div lang={contentLanguage.toLowerCase()}>
                    <SafeMarkdown>{translation.content}</SafeMarkdown>
                  </div>
                ) : (
                  <p>{t.contentMissing}</p>
                )}
              </section>
              <section aria-labelledby="examples-heading" className="space-y-3">
                <h2 id="examples-heading" className="text-xl font-semibold">
                  {t.examplesHeading}
                </h2>
                {translation.examples?.trim() ? (
                  <div lang={contentLanguage.toLowerCase()}>
                    <SafeMarkdown>{translation.examples}</SafeMarkdown>
                  </div>
                ) : (
                  <p>{t.examplesMissing}</p>
                )}
              </section>
            </>
          )}
          <section aria-labelledby="images-heading" className="space-y-3">
            <h2 id="images-heading" className="text-xl font-semibold">
              {t.imagesHeading}
            </h2>
            {element.images.length ? (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {[...element.images]
                  .sort(
                    (a, b) =>
                      a.displayOrder - b.displayOrder ||
                      a.id.localeCompare(b.id),
                  )
                  .map((image) => (
                    <DetailImage key={`${id}:${image.id}`} image={image} />
                  ))}
              </div>
            ) : (
              <p>{t.imagesMissing}</p>
            )}
          </section>
        </>
      )}
    </article>
  )
}
