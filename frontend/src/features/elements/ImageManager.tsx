import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ElementDetail, ElementImage } from '../../api/contracts'
import { ApiError } from '../../api/errors'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/messages'
import { localizeApiError } from '../../i18n/errors'
import { elementsApi, elementKeys } from './queries'
import { DetailImage } from './DetailImage'
import {
  imageMetadataError,
  nextImageOrder,
  validateImageFile,
} from './imageValidation'

export interface ImageEditorState {
  dirty: boolean
  busy: boolean
}
type Draft = { alt: string; order: string }
const draftOf = (image: ElementImage): Draft => ({
  alt: image.altText ?? '',
  order: String(image.displayOrder),
})
const inputClass = 'mt-1 w-full rounded border border-line bg-surface p-2'
const buttonClass =
  'max-w-full break-all rounded border border-line px-3 py-2 disabled:opacity-50'

function FilePreview({
  file,
  onReady,
  onError,
}: {
  file: File
  onReady: () => void
  onError: () => void
}) {
  const ref = useRef<HTMLImageElement>(null)
  const { t } = useI18n()
  useEffect(() => {
    const url = URL.createObjectURL(file)
    ref.current!.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return (
    <img
      ref={ref}
      alt={t.imagePreview}
      onLoad={onReady}
      onError={onError}
      className="max-h-64 max-w-full rounded object-contain"
    />
  )
}

function DeleteImageDialog({
  image,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  image: ElementImage
  busy: boolean
  error: string
  onConfirm: () => Promise<boolean>
  onClose: (deleted: boolean) => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const lock = useRef(false)
  useEffect(() => {
    const node = ref.current!
    node.showModal()
    cancel.current?.focus()
    return () => node.close()
  }, [])
  function close() {
    if (busy || lock.current) return
    ref.current?.close()
    onClose(false)
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-image-heading"
      aria-describedby="delete-image-description delete-image-name"
      className="m-auto w-[calc(100%-2rem)] max-w-lg space-y-4 rounded-xl border border-line bg-surface p-6 text-ink backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <h2 id="delete-image-heading" className="text-xl font-bold">
        {t.imageDeleteHeading}
      </h2>
      <p id="delete-image-name" className="break-all">
        {image.altText || image.fileName}
      </p>
      <p id="delete-image-description">{t.imageDeleteWarning}</p>
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? t.imageWorking : ''}</p>
      <div className="flex flex-wrap gap-4">
        <button
          ref={cancel}
          type="button"
          disabled={busy}
          onClick={close}
          className={buttonClass}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded bg-red-700 px-3 py-2 text-white disabled:opacity-50"
          onClick={async () => {
            if (lock.current) return
            lock.current = true
            const ok = await onConfirm()
            lock.current = false
            if (ok) {
              ref.current?.close()
              onClose(true)
            }
          }}
        >
          {t.imageDelete}
        </button>
      </div>
    </dialog>
  )
}

export function ImageManager({
  element,
  disabled,
  onStateChange,
}: {
  element: ElementDetail
  disabled: boolean
  onStateChange: (state: ImageEditorState) => void
}) {
  const { t, language } = useI18n()
  const client = useQueryClient()
  const [images, setImages] = useState(element.images)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [file, setFile] = useState<File | null>(null)
  const [ready, setReady] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [uploadDraft, setUploadDraft] = useState<Draft>({
    alt: '',
    order: nextImageOrder(images),
  })
  const [orderTouched, setOrderTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState<number | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [validation, setValidation] = useState<MessageKey | null>(null)
  const [done, setDone] = useState(false)
  const [target, setTarget] = useState<ElementImage | null>(null)
  const lock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const dirty =
    !!file ||
    orderTouched ||
    uploadDraft.alt !== '' ||
    Object.keys(drafts).some((id) => {
      const original = images.find((image) => image.id === id)
      return (
        original &&
        (drafts[id].alt !== (original.altText ?? '') ||
          drafts[id].order !== String(original.displayOrder))
      )
    })
  useEffect(() => {
    onStateChange({ dirty, busy })
  }, [dirty, busy, onStateChange])
  useEffect(() => () => controller.current?.abort(), [])
  const apiMessage =
    error === null ? '' : localizeApiError(error, language).message
  const uncertain =
    error instanceof ApiError &&
    (error.status === null ||
      error.status >= 500 ||
      error.code === 'invalid_response')
  const errorMessage = validation
    ? t[validation]
    : `${apiMessage}${uncertain ? ` ${t.imageUncertain}` : ''}`

  function resetUpload(next: ElementImage[]) {
    setFile(null)
    setReady(false)
    setPreviewFailed(false)
    setOrderTouched(false)
    setUploadDraft({ alt: '', order: nextImageOrder(next) })
    if (fileInput.current) fileInput.current.value = ''
  }
  async function run(
    action: (signal: AbortSignal) => Promise<ElementImage[]>,
    after?: (next: ElementImage[]) => void,
  ): Promise<boolean> {
    if (lock.current || disabled) return false
    lock.current = true
    setBusy(true)
    setError(null)
    setValidation(null)
    setDone(false)
    const abort = new AbortController()
    controller.current = abort
    try {
      const next = await action(abort.signal)
      await client.cancelQueries({ queryKey: elementKeys.detail(element.id) })
      setImages(next)
      client.setQueryData<ElementDetail>(
        elementKeys.detail(element.id),
        (old) => (old ? { ...old, images: next } : undefined),
      )
      void client.invalidateQueries({
        queryKey: elementKeys.detail(element.id),
        refetchType: 'none',
      })
      void client.invalidateQueries({ queryKey: elementKeys.list })
      after?.(next)
      setDone(true)
      return true
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure)
      return false
    } finally {
      lock.current = false
      setBusy(false)
      setUploading(false)
      controller.current = null
    }
  }
  function upload() {
    if (lock.current || disabled || !file || !ready || previewFailed) return
    const problem =
      validateImageFile(file) ??
      imageMetadataError(uploadDraft.alt, uploadDraft.order, images)
    if (problem) {
      setValidation(problem)
      return
    }
    setUploading(true)
    setPercent(null)
    void run(
      async (signal) => [
        ...images,
        await elementsApi.uploadImage(
          element.id,
          {
            file,
            altText: uploadDraft.alt,
            displayOrder: Number(uploadDraft.order),
          },
          signal,
          setPercent,
        ),
      ],
      resetUpload,
    )
  }
  function saveImage(image: ElementImage) {
    const draft = drafts[image.id] ?? draftOf(image)
    const problem = imageMetadataError(draft.alt, draft.order, images, image.id)
    if (problem) {
      setValidation(problem)
      return
    }
    void run(
      async (signal) => {
        const updated = await elementsApi.updateImage(
          image.id,
          { altText: draft.alt, displayOrder: Number(draft.order) },
          signal,
        )
        return images.map((item) => (item.id === image.id ? updated : item))
      },
      () =>
        setDrafts((old) => {
          const next = { ...old }
          delete next[image.id]
          return next
        }),
    )
  }
  return (
    <section
      aria-labelledby="image-manager-heading"
      className="mt-8 min-w-0 space-y-5 border-t border-line pt-6"
    >
      <h2
        ref={heading}
        id="image-manager-heading"
        tabIndex={-1}
        className="text-2xl font-bold"
      >
        {t.imageManager}
      </h2>
      <p>{t.imageImmediate}</p>
      <p id="image-hint" className="text-sm text-muted">
        {t.imageHint}
      </p>
      {!target && errorMessage && <p role="alert">{errorMessage}</p>}
      <p role="status">
        {busy
          ? uploading
            ? percent === 100
              ? t.imageProcessing
              : `${t.imageUploading}${percent !== null ? ` ${percent}%` : ''}`
            : t.imageWorking
          : done
            ? t.imageDone
            : ''}
      </p>
      {uploading && (
        <progress
          aria-label={t.imageUploading}
          max={100}
          value={percent ?? undefined}
          className="w-full"
        />
      )}
      <fieldset
        disabled={disabled || busy}
        className="min-w-0 space-y-5 disabled:opacity-60"
      >
        <legend className="sr-only">{t.imageManager}</legend>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!dirty}
            className={buttonClass}
            onClick={() => {
              setDrafts({})
              resetUpload(images)
              setError(null)
              setValidation(null)
            }}
          >
            {t.imageDiscard}
          </button>
          <button
            type="button"
            disabled={dirty}
            className={buttonClass}
            onClick={() =>
              void run(
                async (signal) =>
                  (await elementsApi.get(element.id, signal)).images,
                (next) => {
                  setDrafts({})
                  resetUpload(next)
                },
              )
            }
          >
            {t.imageRefresh}
          </button>
        </div>
        <div className="min-w-0 space-y-4 rounded-lg border border-line p-4">
          <label htmlFor="image-file" className="block font-semibold">
            {t.imageChoose}
          </label>
          <input
            ref={fileInput}
            id="image-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="image-hint"
            className="block w-full min-w-0 text-sm"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null
              setValidation(null)
              setError(null)
              setReady(false)
              setPreviewFailed(false)
              setDone(false)
              const problem = selected ? validateImageFile(selected) : undefined
              if (problem) {
                setFile(null)
                setValidation(problem)
                event.target.value = ''
                return
              }
              setFile(selected)
            }}
          />
          {file && (
            <>
              <p className="break-all">{file.name}</p>
              <FilePreview
                key={`${file.name}:${file.lastModified}:${file.size}`}
                file={file}
                onReady={() => setReady(true)}
                onError={() => {
                  setPreviewFailed(true)
                  setValidation('imagePreviewFailed')
                }}
              />
            </>
          )}
          <label className="block" htmlFor="upload-alt">
            {t.imageAlt}
            <input
              id="upload-alt"
              value={uploadDraft.alt}
              className={inputClass}
              onChange={(event) =>
                setUploadDraft({ ...uploadDraft, alt: event.target.value })
              }
            />
          </label>
          <label className="block" htmlFor="upload-order">
            {t.imageOrder}
            <input
              id="upload-order"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              value={uploadDraft.order}
              className={inputClass}
              onChange={(event) => {
                setOrderTouched(true)
                setUploadDraft({ ...uploadDraft, order: event.target.value })
              }}
            />
          </label>
          <button
            type="button"
            disabled={!file || !ready || previewFailed}
            onClick={upload}
            className={buttonClass}
          >
            {t.imageUpload}
          </button>
        </div>
        {!images.length && <p>{t.imagesMissing}</p>}
        {[...images]
          .sort(
            (a, b) =>
              a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
          )
          .map((image) => {
            const draft = drafts[image.id] ?? draftOf(image)
            const change = (field: keyof Draft, value: string) =>
              setDrafts({ ...drafts, [image.id]: { ...draft, [field]: value } })
            return (
              <div
                key={image.id}
                data-image-id={image.id}
                className="min-w-0 space-y-4 rounded-lg border border-line p-4"
              >
                <DetailImage image={image} />
                <label className="block" htmlFor={`alt-${image.id}`}>
                  {t.imageAlt}
                  <input
                    id={`alt-${image.id}`}
                    className={inputClass}
                    value={draft.alt}
                    onChange={(event) => change('alt', event.target.value)}
                  />
                </label>
                <label className="block" htmlFor={`order-${image.id}`}>
                  {t.imageOrder}
                  <input
                    id={`order-${image.id}`}
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    className={inputClass}
                    value={draft.order}
                    onChange={(event) => change('order', event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => saveImage(image)}
                    className={buttonClass}
                  >
                    {t.imageSave}: {image.fileName}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setValidation(null)
                      setTarget(image)
                    }}
                    className={buttonClass}
                  >
                    {t.imageDelete}: {image.fileName}
                  </button>
                </div>
              </div>
            )
          })}
      </fieldset>
      {target && (
        <DeleteImageDialog
          image={target}
          busy={busy}
          error={errorMessage}
          onConfirm={() =>
            run(
              async (signal) => {
                await elementsApi.removeImage(target.id, signal)
                return images.filter((image) => image.id !== target.id)
              },
              () =>
                setDrafts((old) => {
                  const next = { ...old }
                  delete next[target.id]
                  return next
                }),
            )
          }
          onClose={(deleted) => {
            setTarget(null)
            if (deleted) heading.current?.focus()
          }}
        />
      )}
    </section>
  )
}
