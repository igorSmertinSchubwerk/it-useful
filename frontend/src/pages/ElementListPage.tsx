import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ElementListItem } from '../api/contracts'
import { useI18n } from '../i18n/context'
import { localizeApiError } from '../i18n/errors'
import { elementPath } from '../utils/paths'
import { useElements } from '../features/elements/queries'
import {
  parseContentLanguage,
  parseSort,
  selectElements,
} from '../features/elements/list'
import { DeleteElementDialog } from '../features/elements/DeleteElementDialog'

export default function ElementListPage() {
  const { t, language } = useI18n()
  const [params, setParams] = useSearchParams()
  const contentLanguage = parseContentLanguage(params.get('language'))
  const search = params.get('q') ?? ''
  const sort = parseSort(params.get('sort'))
  const query = useElements()
  const [selected, setSelected] = useState<ElementListItem | null>(null)
  const [deleted, setDeleted] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const items = selectElements(query.data ?? [], contentLanguage, search, sort)
  function updateParam(key: string, value: string, replace = false) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace },
    )
  }
  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium' })
  return (
    <>
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-3xl font-bold tracking-tight sm:text-4xl"
      >
        {t.homeTitle}
      </h1>
      <p className="mt-4 text-muted">{t.editorNotice}</p>
      <div className="mt-6 flex flex-wrap items-end gap-4">
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
            onChange={(event) => updateParam('language', event.target.value)}
            className="mt-1 max-w-full rounded border border-line bg-surface p-2"
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
        <div className="min-w-0 basis-48 flex-1">
          <label htmlFor="search" className="block text-sm font-semibold">
            {t.search}
          </label>
          <input
            id="search"
            type="search"
            value={search}
            onChange={(event) => updateParam('q', event.target.value, true)}
            className="mt-1 w-full rounded border border-line bg-surface p-2"
          />
        </div>
        <div className="max-w-full">
          <label htmlFor="sort" className="block text-sm font-semibold">
            {t.sort}
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(event) => updateParam('sort', event.target.value)}
            className="mt-1 max-w-full rounded border border-line bg-surface p-2"
          >
            <option value="title-asc">{t.titleAsc}</option>
            <option value="title-desc">{t.titleDesc}</option>
            <option value="newest">{t.newest}</option>
            <option value="oldest">{t.oldest}</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <button
          type="button"
          className="text-brand underline"
          onClick={() =>
            setParams((previous) => {
              const next = new URLSearchParams(previous)
              next.delete('q')
              next.delete('sort')
              return next
            })
          }
        >
          {t.clearFilters}
        </button>
        <button
          type="button"
          disabled={query.isFetching}
          className="text-brand underline disabled:opacity-50"
          onClick={() => void query.refetch()}
        >
          {t.refresh}
        </button>
        <Link
          to={`/elements/new${params.size ? `?${params.toString()}` : ''}`}
          className="text-brand underline"
        >
          {t.create}
        </Link>
      </div>
      <p role="status" className="mt-5 text-sm text-muted">
        {deleted ? `${t.deleted} ` : ''}
        {query.isPending
          ? t.loading
          : query.isFetching
            ? t.refreshing
            : query.data
              ? `${t.results}: ${items.length} / ${query.data.length}`
              : ''}
      </p>
      {query.isError && (
        <div
          role="alert"
          className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-900"
        >
          <p>
            {query.data
              ? t.stale
              : localizeApiError(query.error, language).message}
          </p>
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="mt-2 underline"
          >
            {t.retry}
          </button>
        </div>
      )}
      {query.data &&
        (query.data.length === 0 ? (
          <p className="mt-6 rounded border border-line bg-surface p-6">
            {t.empty}
          </p>
        ) : items.length === 0 ? (
          <p className="mt-6 rounded border border-line bg-surface p-6">
            {t.noMatches}
          </p>
        ) : (
          <div
            role="region"
            aria-label={t.definitions}
            tabIndex={0}
            className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface"
          >
            <table className="w-full min-w-[640px] text-left">
              <caption className="sr-only">{t.definitions}</caption>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  {[t.title, t.slug, t.updated, t.actions].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="max-w-xs break-words px-4 py-4">
                      <Link
                        to={`${elementPath(item.id)}${params.size ? `?${params.toString()}` : ''}`}
                        className="font-semibold text-brand underline"
                        lang={
                          item.titles[contentLanguage]?.trim()
                            ? contentLanguage.toLowerCase()
                            : language
                        }
                      >
                        {item.titles[contentLanguage]?.trim() ||
                          `${t.missingTitle} (${item.slug})`}
                      </Link>
                    </td>
                    <td className="max-w-xs break-all px-4 py-4">
                      {item.slug}
                    </td>
                    <td className="px-4 py-4">
                      {Number.isNaN(Date.parse(item.updatedAt)) ? (
                        '—'
                      ) : (
                        <time dateTime={item.updatedAt}>
                          {dateFormat.format(new Date(item.updatedAt))}
                        </time>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-3">
                        <Link
                          to={`${elementPath(item.id, true)}${params.size ? `?${params.toString()}` : ''}`}
                          aria-label={`${t.edit}: ${item.titles[contentLanguage] || item.slug}`}
                          className="text-brand underline"
                        >
                          {t.edit}
                        </Link>
                        <button
                          type="button"
                          aria-label={`${t.delete}: ${item.titles[contentLanguage] || item.slug}`}
                          className="text-red-800 underline"
                          onClick={() => {
                            setDeleted(false)
                            setSelected(item)
                          }}
                        >
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {selected && (
        <DeleteElementDialog
          element={selected}
          contentLanguage={contentLanguage}
          onCancel={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null)
            setDeleted(true)
            heading.current?.focus()
          }}
        />
      )}
    </>
  )
}
