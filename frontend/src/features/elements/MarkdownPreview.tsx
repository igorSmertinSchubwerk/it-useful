import { useDeferredValue } from 'react'
import { SafeMarkdown } from './SafeMarkdown'
import { useI18n } from '../../i18n/context'
import type { LanguageCode } from '../../api/contracts'

export function MarkdownPreview({
  content,
  examples,
  language,
}: {
  content: string
  examples: string
  language: LanguageCode
}) {
  const { t } = useI18n()
  const deferredContent = useDeferredValue(content)
  const deferredExamples = useDeferredValue(examples)
  return (
    <section
      aria-labelledby="preview-heading"
      className="min-w-0 space-y-4 rounded-lg border border-line p-4"
    >
      <h2 id="preview-heading" className="text-xl font-semibold">
        {t.previewHeading}
      </h2>
      {!content && !examples && <p>{t.previewEmpty}</p>}
      <div lang={language.toLowerCase()}>
        <SafeMarkdown>{deferredContent}</SafeMarkdown>
      </div>
      {deferredExamples && (
        <>
          <h2 className="text-lg font-semibold">{t.examplesHeading}</h2>
          <div lang={language.toLowerCase()}>
            <SafeMarkdown>{deferredExamples}</SafeMarkdown>
          </div>
        </>
      )}
    </section>
  )
}
