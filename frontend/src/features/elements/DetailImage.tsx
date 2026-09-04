import { useState } from 'react'
import type { ElementImage } from '../../api/contracts'
import { useI18n } from '../../i18n/context'
import { elementsApi } from './queries'

export function DetailImage({ image }: { image: ElementImage }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const description = image.altText?.trim() || image.fileName
  return (
    <figure className="min-w-0 space-y-2 rounded-lg border border-line p-3">
      {failed ? (
        <div role="status" className="space-y-3 p-4">
          <p>{t.imageFailed}</p>
          <button
            type="button"
            className="text-brand underline"
            onClick={() => {
              setAttempt(attempt + 1)
              setFailed(false)
            }}
          >
            {t.imageRetry}: {description}
          </button>
        </div>
      ) : (
        <img
          src={`${elementsApi.imageUrl(image.id)}${attempt ? `?retry=${attempt}` : ''}`}
          alt={description}
          loading="lazy"
          decoding="async"
          className="mx-auto h-auto max-h-96 max-w-full rounded object-contain"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="break-words text-sm text-muted">
        {description}
      </figcaption>
    </figure>
  )
}
