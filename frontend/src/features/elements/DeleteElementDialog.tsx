import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ElementListItem, LanguageCode } from '../../api/contracts'
import { useI18n } from '../../i18n/context'
import { localizeApiError } from '../../i18n/errors'
import { elementKeys, elementsApi } from './queries'

export function DeleteElementDialog({
  element,
  contentLanguage,
  onCancel,
  onDeleted,
}: {
  element: ElementListItem
  contentLanguage: LanguageCode
  onCancel: () => void
  onDeleted: () => void
}) {
  const { t, language } = useI18n()
  const client = useQueryClient()
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const locked = useRef(false)
  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    cancel.current?.focus()
    return () => node.close()
  }, [])
  const mutation = useMutation({
    mutationFn: () => elementsApi.remove(element.id),
    retry: false,
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: elementKeys.all })
      client.setQueryData<ElementListItem[]>(elementKeys.list, (items) =>
        items?.filter((item) => item.id !== element.id),
      )
      client.removeQueries({
        queryKey: elementKeys.detail(element.id),
        exact: true,
      })
      void client.invalidateQueries({ queryKey: elementKeys.list })
      dialog.current?.close()
      onDeleted()
    },
    onSettled: () => {
      locked.current = false
    },
  })
  function confirm() {
    if (locked.current) return
    locked.current = true
    mutation.mutate()
  }
  function dismiss() {
    if (locked.current) return
    dialog.current?.close()
    onCancel()
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-heading"
      aria-describedby="delete-target delete-description"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-surface p-6 text-ink backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
    >
      <h2 id="delete-heading" className="text-xl font-bold">
        {t.deleteTitle}
      </h2>
      <p
        id="delete-target"
        className="mt-4 break-words font-semibold"
        lang={contentLanguage.toLowerCase()}
      >
        {element.titles[contentLanguage]?.trim() || element.slug}
      </p>
      <p className="mt-1 break-all text-sm text-muted">{element.slug}</p>
      <p id="delete-description" className="mt-4">
        {t.deleteWarning}
      </p>
      {mutation.isError && (
        <p role="alert" className="mt-4 text-red-800">
          {localizeApiError(mutation.error, language).message}
        </p>
      )}
      <p role="status" className="mt-3">
        {mutation.isPending ? t.deleting : ''}
      </p>
      <div className="mt-5 flex flex-wrap gap-4">
        <button
          ref={cancel}
          type="button"
          disabled={mutation.isPending}
          onClick={dismiss}
          className="rounded border border-line px-4 py-2 disabled:opacity-50"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={confirm}
          className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {t.delete}
        </button>
      </div>
    </dialog>
  )
}
