import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  useBlocker,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import type { FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/errors'
import type { ElementDetail } from '../../api/contracts'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/messages'
import { localizeApiError } from '../../i18n/errors'
import {
  elementSchema,
  initialValues,
  languages,
  serverField,
} from '../../schemas/elementSchema'
import type {
  EditableField,
  ElementFormValues,
} from '../../schemas/elementSchema'
import { elementPath } from '../../utils/paths'
import { elementsApi, elementKeys } from './queries'
import { parseContentLanguage } from './list'
import { MarkdownPreview } from './MarkdownPreview'
import { UnsavedChanges } from './UnsavedChanges'

const names = ['English', 'Deutsch', 'Русский']
const fieldNames = ['title', 'content', 'examples'] as const
const fieldLabels = {
  title: 'titleLabel',
  content: 'contentLabel',
  examples: 'examplesLabel',
} as const
const knownMessages = new Set([
  'requiredField',
  'titleLimit',
  'textLimit',
  'slugLimit',
  'slugRule',
  'errorField',
  'errorSlug',
])

export function ElementForm({ element }: { element?: ElementDetail }) {
  const { t, language } = useI18n()
  const [params] = useSearchParams()
  const [active, setActive] = useState(() =>
    languages.indexOf(parseContentLanguage(params.get('language'))),
  )
  const [defaults] = useState(() => initialValues(element))
  const [saveError, setSaveError] = useState<unknown>(null)
  const lock = useRef(false)
  const saved = useRef(false)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const navigate = useNavigate()
  const client = useQueryClient()
  const {
    register,
    handleSubmit,
    control,
    setError,
    setFocus,
    clearErrors,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ElementFormValues>({
    resolver: zodResolver(elementSchema),
    defaultValues: defaults,
    shouldFocusError: false,
  })
  const translations = useWatch({ control, name: 'translations' })
  const mutation = useMutation({
    mutationFn: (values: ElementFormValues) =>
      element
        ? elementsApi.update(element.id, values)
        : elementsApi.create(values),
    retry: false,
  })
  const blocker = useBlocker(
    useCallback(() => !saved.current && (isDirty || lock.current), [isDirty]),
  )
  useEffect(() => {
    if (!isDirty && !isSubmitting) return
    const warn = (event: BeforeUnloadEvent) => {
      if (saved.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty, isSubmitting])

  function focusField(field: EditableField) {
    const match = /^translations\.([012])\./.exec(field)
    if (match) setActive(Number(match[1]))
    requestAnimationFrame(() => setFocus(field))
  }
  function firstError(fields: FieldErrors<ElementFormValues>) {
    if (fields.slug) {
      focusField('slug')
      return
    }
    for (const index of [0, 1, 2] as const) {
      for (const field of fieldNames) {
        if (fields.translations?.[index]?.[field]) {
          focusField(`translations.${index}.${field}`)
          return
        }
      }
    }
  }
  function message(code?: string) {
    return t[
      (code && knownMessages.has(code) ? code : 'errorField') as MessageKey
    ]
  }
  async function submit(values: ElementFormValues) {
    setSaveError(null)
    clearErrors()
    try {
      const result = await mutation.mutateAsync(values)
      await client.cancelQueries({ queryKey: elementKeys.all })
      client.setQueryData(elementKeys.detail(result.id), result)
      void client.invalidateQueries({ queryKey: elementKeys.list })
      saved.current = true
      reset(initialValues(result))
      // Successful submission always goes to the saved detail, even if a
      // navigation was blocked while the request was pending.
      if (blocker.state === 'blocked') blocker.reset()
      const next = new URLSearchParams(params)
      next.set('language', languages[active])
      void navigate(`${elementPath(result.id)}?${next.toString()}`, {
        replace: true,
      })
    } catch (error) {
      setSaveError(error)
      if (error instanceof ApiError) {
        let first: EditableField | undefined
        if (error.code === 'duplicate_slug') {
          setError('slug', { type: 'server', message: 'errorSlug' })
          first = 'slug'
        }
        for (const issue of error.fieldErrors) {
          const field = serverField(issue.field)
          if (field) {
            setError(field, { type: 'server', message: 'errorField' })
            first ??= field
          }
        }
        if (first) focusField(first)
      }
    }
  }
  const suffix = params.size ? `?${params.toString()}` : ''
  return (
    <>
      <form
        noValidate
        className="min-w-0 space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (lock.current) return
          lock.current = true
          void handleSubmit(
            submit,
            firstError,
          )(event).finally(() => {
            lock.current = false
          })
        }}
      >
        <p>{t.editorHelp}</p>
        {Object.keys(errors).length > 0 && <p role="alert">{t.formErrors}</p>}
        {saveError !== null && (
          <p role="alert">
            {localizeApiError(saveError, language).message}
            {saveError instanceof ApiError &&
            (saveError.status === null ||
              saveError.status >= 500 ||
              saveError.code === 'invalid_response')
              ? ` ${t.unknownSave}`
              : ''}
          </p>
        )}
        <fieldset
          disabled={isSubmitting}
          className="min-w-0 space-y-6 disabled:opacity-70"
        >
          <legend className="sr-only">{element ? t.edit : t.create}</legend>
          <div>
            <label htmlFor="slug" className="block font-semibold">
              {t.slug}
            </label>
            <input
              id="slug"
              {...register('slug')}
              aria-required="true"
              aria-invalid={!!errors.slug}
              aria-describedby={`slug-hint${errors.slug ? ' slug-error' : ''}`}
              className="mt-1 w-full rounded border border-line bg-surface p-2"
            />
            <p id="slug-hint" className="mt-1 text-sm text-muted">
              {t.slugHint}
            </p>
            {errors.slug && (
              <p id="slug-error" className="mt-1 text-red-800">
                {message(errors.slug.message)}
              </p>
            )}
          </div>
          <div
            role="tablist"
            aria-label={t.translationTabs}
            className="flex flex-wrap gap-3"
          >
            {languages.map((code, index) => (
              <button
                key={code}
                ref={(node) => {
                  tabs.current[index] = node
                }}
                id={`tab-${code}`}
                type="button"
                role="tab"
                aria-selected={active === index}
                aria-controls={`panel-${code}`}
                tabIndex={active === index ? 0 : -1}
                className="rounded border border-line px-3 py-2 aria-selected:bg-brand aria-selected:text-white"
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  const target =
                    event.key === 'ArrowRight'
                      ? (index + 1) % 3
                      : event.key === 'ArrowLeft'
                        ? (index + 2) % 3
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? 2
                            : undefined
                  if (target !== undefined) {
                    event.preventDefault()
                    setActive(target)
                    tabs.current[target]?.focus()
                  }
                }}
              >
                <span lang={code.toLowerCase()}>{names[index]}</span>
                {errors.translations?.[index] && <span> — {t.hasErrors}</span>}
              </button>
            ))}
          </div>
          {languages.map((code, index) => (
            <div
              key={code}
              id={`panel-${code}`}
              role="tabpanel"
              aria-labelledby={`tab-${code}`}
              hidden={active !== index}
              className="min-w-0 space-y-5"
            >
              {fieldNames.map((field) => {
                const path = `translations.${index}.${field}` as EditableField
                const error = errors.translations?.[index]?.[field]
                const id = `${code}-${field}`
                const props = {
                  id,
                  ...register(path),
                  lang: code.toLowerCase(),
                  'aria-required': field !== 'examples',
                  'aria-invalid': !!error,
                  'aria-describedby': error ? `${id}-error` : undefined,
                  className:
                    'mt-1 w-full rounded border border-line bg-surface p-2',
                }
                return (
                  <div key={field}>
                    <label htmlFor={id} className="block font-semibold">
                      {t[fieldLabels[field]]}
                    </label>
                    {field === 'title' ? (
                      <input {...props} />
                    ) : (
                      <textarea
                        {...props}
                        rows={field === 'content' ? 10 : 6}
                      />
                    )}
                    {error && (
                      <p id={`${id}-error`} className="text-red-800">
                        {message(error.message)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <button
            type="submit"
            className="rounded bg-brand px-4 py-2 font-semibold text-white"
          >
            {isSubmitting ? t.saving : t.save}
          </button>
        </fieldset>
        <p role="status">
          {isSubmitting ? t.saving : isDirty ? t.unsavedStatus : ''}
        </p>
        <Link
          to={element ? `${elementPath(element.id)}${suffix}` : `/${suffix}`}
          className="inline-block text-brand underline"
        >
          {t.cancel}
        </Link>
        <p className="text-sm text-muted">{t.imageEditorLater}</p>
        <MarkdownPreview
          content={translations[active]?.content ?? ''}
          examples={translations[active]?.examples ?? ''}
          language={languages[active]}
        />
      </form>
      <UnsavedChanges blocker={blocker} saving={isSubmitting} />
    </>
  )
}
