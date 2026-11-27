import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import {
  Link,
  useBlocker,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/errors'
import type { ElementDetail } from '../../api/contracts'
import { UploadIcon } from '../../components/icons'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/messages'
import { localizeApiError } from '../../i18n/errors'
import {
  elementSchema,
  initialValues,
  languages,
  serverField,
  toWriteRequest,
} from '../../schemas/elementSchema'
import type {
  EditableField,
  ElementFormValues,
} from '../../schemas/elementSchema'
import { definitionsPath, elementPath } from '../../utils/paths'
import { elementsApi, elementKeys, useElements } from './queries'
import { parseContentLanguage } from './list'
import { UnsavedChanges } from './UnsavedChanges'
import { ImageManager } from './ImageManager'
import { PendingImages } from './PendingImages'
import { RichTextEditor } from './RichTextEditor'
import { parseDefinitionFile } from './importFile'
import { duplicateTitles } from './titles'
import { cardClass, cardLabelClass, pillButtonClass } from './formStyles'

const names = ['English', 'Deutsch', 'Русский']
const fieldNames = ['title', 'content', 'examples'] as const
type FieldName = (typeof fieldNames)[number]
const fieldLabels = {
  title: 'titleLabel',
  content: 'contentLabel',
  examples: 'examplesLabel',
} as const
const knownMessages = new Set([
  'requiredField',
  'titleLimit',
  'textLimit',
  'titleSlugRule',
  'errorField',
  'errorSlug',
])
const maxImportBytes = 1024 * 1024
const alertClass =
  'rounded-2xl border border-red-300 bg-red-50 px-5 py-3 text-red-900'

function LanguageSwitch({
  active,
  flagged,
  onSelect,
}: {
  active: number
  flagged: (index: number) => boolean
  onSelect: (index: number) => void
}) {
  const { t } = useI18n()
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const keys: Record<string, number> = {
    ArrowRight: (active + 1) % 3,
    ArrowLeft: (active + 2) % 3,
    Home: 0,
    End: 2,
  }
  return (
    <div
      role="tablist"
      aria-label={t.translationTabs}
      className="relative grid w-full grid-cols-3 rounded-full border border-line bg-canvas p-1 sm:w-auto"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-brand shadow transition-transform duration-200"
        style={{ transform: `translateX(${active * 100}%)` }}
      />
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
          aria-controls={fieldNames
            .map((field) => `panel-${code}-${field}`)
            .join(' ')}
          tabIndex={active === index ? 0 : -1}
          className="relative z-10 rounded-full px-2 py-1.5 text-sm font-semibold transition-colors aria-selected:text-on-brand sm:px-4"
          onClick={() => onSelect(index)}
          onKeyDown={(event) => {
            const target = keys[event.key]
            if (target === undefined) return
            event.preventDefault()
            onSelect(target)
            tabs.current[target]?.focus()
          }}
        >
          <span lang={code.toLowerCase()}>{names[index]}</span>
          {flagged(index) && (
            <>
              {' '}
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block size-2 rounded-full bg-red-600 align-middle ring-2 ring-surface"
              />
              <span className="sr-only">— {t.hasErrors}</span>
            </>
          )}
        </button>
      ))}
    </div>
  )
}

export function ElementForm({
  element,
  headerSlot,
}: {
  element?: ElementDetail
  /** Where the import button and the language switch go, next to the page title. */
  headerSlot: HTMLElement | null
}) {
  const { t, language } = useI18n()
  const [params] = useSearchParams()
  const location = useLocation()
  const [active, setActive] = useState(() =>
    languages.indexOf(parseContentLanguage(params.get('language'))),
  )
  const [defaults] = useState(() => initialValues(element))
  const [saveError, setSaveError] = useState<unknown>(null)
  const [imageState, setImageState] = useState({ dirty: false, busy: false })
  const [queued, setQueued] = useState<File[]>([])
  const [imported, setImported] = useState<'importDone' | 'importInvalid'>()
  const lock = useRef(false)
  const saved = useRef(false)
  const navigate = useNavigate()
  const client = useQueryClient()
  const others = useElements().data
  const {
    register,
    handleSubmit,
    control,
    setError,
    setFocus,
    setValue,
    clearErrors,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ElementFormValues>({
    resolver: zodResolver(elementSchema),
    defaultValues: defaults,
    shouldFocusError: false,
  })
  const translations = useWatch({ control, name: 'translations' })
  const duplicates = duplicateTitles({ translations }, others ?? [], element)
  const mutation = useMutation({
    mutationFn: (values: ElementFormValues) =>
      element
        ? elementsApi.update(element.id, toWriteRequest(values, element))
        : elementsApi.create(toWriteRequest(values)),
    retry: false,
  })
  const unsaved = isDirty || imageState.dirty || queued.length > 0
  const blocker = useBlocker(
    useCallback(
      () => !saved.current && (unsaved || lock.current || imageState.busy),
      [unsaved, imageState.busy],
    ),
  )
  useEffect(() => {
    if (!unsaved && !isSubmitting && !imageState.busy) return
    const warn = (event: BeforeUnloadEvent) => {
      if (saved.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved, isSubmitting, imageState.busy])

  const locked = isSubmitting || imageState.busy
  const focusTarget = useRef<EditableField>(undefined)
  // A disabled field cannot take the focus, and an editor of another language
  // is not mounted yet. So the focus moves once the form is editable again.
  useEffect(() => {
    if (!focusTarget.current || locked) return
    setFocus(focusTarget.current)
    focusTarget.current = undefined
  })
  function focusField(field: EditableField) {
    focusTarget.current = field
    setActive(Number(field.split('.')[1]))
  }
  function firstError(fields: FieldErrors<ElementFormValues>) {
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
  function showServerErrors(error: ApiError) {
    let first: EditableField | undefined
    if (error.code === 'duplicate_slug') {
      first = 'translations.0.title'
      setError(first, { type: 'server', message: 'errorSlug' })
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
  /** Reports whether every queued image reached the new definition. */
  async function uploadQueued(id: string) {
    let complete = true
    for (const [displayOrder, file] of queued.entries()) {
      try {
        await elementsApi.uploadImage(id, { file, displayOrder })
      } catch {
        complete = false
      }
    }
    if (queued.length)
      await client.invalidateQueries({ queryKey: elementKeys.detail(id) })
    return complete
  }
  async function submit(values: ElementFormValues) {
    setSaveError(null)
    clearErrors()
    const taken = duplicateTitles(values, others ?? [], element)
    if (taken.length) {
      focusField(`translations.${taken[0] as 0 | 1 | 2}.title`)
      return
    }
    try {
      const result = await mutation.mutateAsync(values)
      await client.cancelQueries({ queryKey: elementKeys.all })
      client.setQueryData(elementKeys.detail(result.id), result)
      void client.invalidateQueries({ queryKey: elementKeys.list })
      const complete = await uploadQueued(result.id)
      saved.current = true
      reset(initialValues(result))
      // Successful submission always goes to the saved definition, even if a
      // navigation was blocked while the request was pending.
      if (blocker.state === 'blocked') blocker.reset()
      const next = new URLSearchParams(params)
      next.set('language', languages[active])
      void navigate(`${elementPath(result.id, !complete)}?${next.toString()}`, {
        replace: true,
        state: complete ? undefined : { imagesFailed: true },
      })
    } catch (error) {
      setSaveError(error)
      if (error instanceof ApiError) showServerErrors(error)
    }
  }
  async function importFile(file: File) {
    const parsed =
      file.size <= maxImportBytes
        ? parseDefinitionFile(file.name, await file.text())
        : undefined
    setImported(parsed ? 'importDone' : 'importInvalid')
    if (!parsed) return
    languages.forEach((code, index) => {
      for (const field of fieldNames) {
        const value = parsed[code]?.[field]
        if (value !== undefined)
          setValue(`translations.${index as 0 | 1 | 2}.${field}`, value, {
            shouldDirty: true,
          })
      }
    })
  }
  const suffix = params.size ? `?${params.toString()}` : ''
  const imagesFailed =
    (location.state as { imagesFailed?: boolean } | null)?.imagesFailed === true

  function fieldCard(field: FieldName, input: (index: 0 | 1 | 2) => ReactNode) {
    return (
      <fieldset disabled={locked} className={cardClass}>
        {([0, 1, 2] as const).map((index) => {
          const code = languages[index]
          const id = `${code}-${field}`
          const duplicate = field === 'title' && duplicates.includes(index)
          const error = errors.translations?.[index]?.[field]
          return (
            <div
              key={code}
              id={`panel-${code}-${field}`}
              role="tabpanel"
              aria-labelledby={`tab-${code}`}
              hidden={active !== index}
            >
              <label id={`${id}-label`} htmlFor={id} className={cardLabelClass}>
                {t[fieldLabels[field]]}
                {field !== 'examples' && (
                  <span aria-hidden="true" className="ml-1 text-red-800">
                    *
                  </span>
                )}
              </label>
              {input(index)}
              {(error || duplicate) && (
                <p id={`${id}-error`} className="mt-2 text-red-800">
                  {error ? message(error.message) : t.errorSlug}
                </p>
              )}
            </div>
          )
        })}
      </fieldset>
    )
  }
  function titleInput(index: 0 | 1 | 2) {
    const id = `${languages[index]}-title`
    const invalid =
      !!errors.translations?.[index]?.title || duplicates.includes(index)
    return (
      <input
        id={id}
        {...register(`translations.${index}.title`)}
        lang={languages[index].toLowerCase()}
        aria-required="true"
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-lg aria-invalid:border-red-800"
      />
    )
  }
  function textInput(field: 'content' | 'examples') {
    return function TextInput(index: 0 | 1 | 2) {
      // Six mounted editors make the page slow. The form keeps the hidden values.
      if (index !== active) return null
      const id = `${languages[index]}-${field}`
      const invalid = !!errors.translations?.[index]?.[field]
      return (
        <Controller
          control={control}
          name={`translations.${index}.${field}`}
          render={({ field: bound }) => (
            <RichTextEditor
              ref={bound.ref}
              id={id}
              labelledBy={`${id}-label`}
              describedBy={invalid ? `${id}-error` : undefined}
              lang={languages[index].toLowerCase()}
              value={bound.value}
              onChange={bound.onChange}
              required={field === 'content'}
              invalid={invalid}
              disabled={locked}
            />
          )}
        />
      )
    }
  }
  return (
    <>
      <form
        noValidate
        className="min-w-0 space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (lock.current || imageState.dirty || imageState.busy) return
          lock.current = true
          void handleSubmit(
            submit,
            firstError,
          )(event).finally(() => {
            lock.current = false
          })
        }}
      >
        {headerSlot &&
          createPortal(
            <>
              <label className={pillButtonClass}>
                <UploadIcon />
                {t.importFile}
                <input
                  type="file"
                  disabled={locked}
                  accept=".txt,.md,.xml,.json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void importFile(file)
                  }}
                />
              </label>
              <LanguageSwitch
                active={active}
                flagged={(index) =>
                  !!errors.translations?.[index] || duplicates.includes(index)
                }
                onSelect={setActive}
              />
            </>,
            headerSlot,
          )}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className={alertClass}>
            {t.formErrors}
          </p>
        )}
        {saveError !== null && (
          <p role="alert" className={alertClass}>
            {localizeApiError(saveError, language).message}
            {saveError instanceof ApiError &&
            (saveError.status === null ||
              saveError.status >= 500 ||
              saveError.code === 'invalid_response')
              ? ` ${t.unknownSave}`
              : ''}
          </p>
        )}
        {imagesFailed && (
          <p role="alert" className={alertClass}>
            {t.imageQueueFailed}
          </p>
        )}
        {imported === 'importInvalid' && (
          <p role="alert" className={alertClass}>
            {t.importInvalid}
          </p>
        )}
        {fieldCard('title', titleInput)}
        {fieldCard('content', textInput('content'))}
        {element ? (
          <ImageManager
            element={element}
            disabled={isSubmitting}
            onStateChange={setImageState}
          />
        ) : (
          <PendingImages
            files={queued}
            disabled={locked}
            onChange={setQueued}
          />
        )}
        {fieldCard('examples', textInput('examples'))}
        <p role="status" className="text-center text-sm text-muted">
          {isSubmitting
            ? t.saving
            : imageState.dirty
              ? t.imageDrafts
              : imported === 'importDone'
                ? t.importDone
                : unsaved
                  ? t.unsavedStatus
                  : ''}
        </p>
        <div
          data-dock
          className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-3xl bg-dock p-2 text-dock-ink shadow-lg shadow-black/10 sm:rounded-full"
        >
          <Link
            to={
              element
                ? `${elementPath(element.id)}${suffix}`
                : `${definitionsPath}${suffix}`
            }
            className="rounded-full px-5 py-2 font-semibold hover:bg-dock-ink/15"
          >
            {t.cancel}
          </Link>
          <button
            type="submit"
            disabled={locked || imageState.dirty}
            className="rounded-full bg-dock-active px-5 py-2 font-semibold text-dock-active-ink disabled:opacity-50"
          >
            {isSubmitting ? t.saving : t.save}
          </button>
        </div>
      </form>
      <UnsavedChanges blocker={blocker} saving={locked} />
    </>
  )
}
