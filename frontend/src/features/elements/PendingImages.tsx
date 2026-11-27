import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/messages'
import { ImageIcon } from '../../components/icons'
import { validateImageFile } from './imageValidation'
import { cardClass, cardLabelClass, pillButtonClass } from './formStyles'

export const maxImages = 5

function Thumbnail({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    ref.current!.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return (
    <img
      ref={ref}
      alt={file.name}
      className="aspect-square w-full rounded-xl object-cover"
    />
  )
}

/** Images chosen for a definition that has no id yet. They upload after it is saved. */
export function PendingImages({
  files,
  disabled,
  onChange,
}: {
  files: File[]
  disabled: boolean
  onChange: (files: File[]) => void
}) {
  const { t } = useI18n()
  const [problem, setProblem] = useState<MessageKey | null>(null)

  function add(chosen: File[]) {
    const invalid = chosen.map(validateImageFile).find(Boolean)
    const next = [
      ...files,
      ...chosen.filter((file) => !validateImageFile(file)),
    ]
    setProblem(
      next.length > maxImages ? 'imageLimitReached' : (invalid ?? null),
    )
    onChange(next.slice(0, maxImages))
  }
  return (
    <section
      aria-labelledby="pending-images"
      className={`${cardClass} space-y-4`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="pending-images" className={`${cardLabelClass} mr-auto`}>
          {t.imagesHeading}
        </h2>
        <span id="image-files-hint" className="text-sm text-muted">
          {t.imageLimit}
        </span>
        <label className={pillButtonClass}>
          <ImageIcon />
          {t.imageAdd}
          <input
            type="file"
            multiple
            disabled={disabled}
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="image-files-hint"
            className="sr-only"
            onChange={(event) => {
              add([...(event.target.files ?? [])])
              event.target.value = ''
            }}
          />
        </label>
      </div>
      {problem && (
        <p role="alert" className="text-red-800">
          {t[problem]}
        </p>
      )}
      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {files.map((file, index) => (
            <li key={`${file.name}:${file.size}:${index}`} className="relative">
              <Thumbnail file={file} />
              <button
                type="button"
                disabled={disabled}
                aria-label={`${t.imageRemove}: ${file.name}`}
                title={t.imageRemove}
                className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-surface text-lg font-bold text-ink shadow"
                onClick={() => {
                  setProblem(null)
                  onChange(files.filter((_, other) => other !== index))
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
