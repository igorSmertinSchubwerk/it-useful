import { useEffect, useRef } from 'react'
import type { Blocker } from 'react-router-dom'
import { useI18n } from '../../i18n/context'

export function UnsavedChanges({
  blocker,
  saving,
}: {
  blocker: Blocker
  saving: boolean
}) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const stay = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const node = dialog.current!
    node.showModal()
    stay.current?.focus()
    return () => node.close()
    // Depend on each navigation attempt: rapid reset/Back can remain 'blocked'
    // across a batched render even though the previous dialog was closed.
  }, [blocker])
  if (blocker.state !== 'blocked') return null
  return (
    <dialog
      ref={dialog}
      aria-labelledby="unsaved-heading"
      aria-describedby="unsaved-description"
      className="m-auto w-[calc(100%-2rem)] max-w-lg space-y-5 rounded-xl border border-line bg-surface p-6 text-ink backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault()
        dialog.current?.close()
        blocker.reset()
      }}
    >
      <h2 id="unsaved-heading" className="text-xl font-bold">
        {t.unsavedHeading}
      </h2>
      <p id="unsaved-description">{saving ? t.saving : t.unsavedText}</p>
      <div className="flex flex-wrap gap-4">
        <button
          ref={stay}
          type="button"
          className="rounded border border-line px-4 py-2"
          onClick={() => {
            dialog.current?.close()
            blocker.reset()
          }}
        >
          {t.stay}
        </button>
        <button
          type="button"
          disabled={saving}
          className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
          onClick={() => {
            dialog.current?.close()
            blocker.proceed()
          }}
        >
          {t.leave}
        </button>
      </div>
    </dialog>
  )
}
