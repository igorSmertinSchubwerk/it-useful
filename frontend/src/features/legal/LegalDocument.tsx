import { useI18n } from '../../i18n/context'
import type { LegalSection } from './legalTexts'

function Sections({
  sections,
  level,
}: {
  sections: LegalSection[]
  level: 'h2' | 'h3'
}) {
  const Heading = level
  return sections.map((section) => (
    <section key={section.heading} className="mt-6">
      <Heading className="text-lg font-semibold">{section.heading}</Heading>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-2">
          {paragraph}
        </p>
      ))}
    </section>
  ))
}

/**
 * Shows a legal text in its binding German version, followed by the English
 * translation.
 */
export function LegalDocument({
  germanTitle,
  englishTitle,
  text,
}: {
  germanTitle: string
  englishTitle: string
  text: { de: LegalSection[]; en: LegalSection[] }
}) {
  const { t } = useI18n()
  return (
    <article className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-bold" lang="de">
        {germanTitle}
      </h1>
      <p className="mt-4 text-muted">{t.legalTextNote}</p>
      <div lang="de">
        <Sections sections={text.de} level="h2" />
      </div>
      <div lang="en" className="mt-10 border-t border-line pt-6">
        <h2 className="text-2xl font-bold">{englishTitle}</h2>
        <Sections sections={text.en} level="h3" />
      </div>
    </article>
  )
}
