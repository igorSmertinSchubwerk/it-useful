import { LegalDocument } from '../features/legal/LegalDocument'
import { legalNotice } from '../features/legal/legalTexts'

export function LegalNoticePage() {
  return (
    <LegalDocument
      germanTitle="Impressum"
      englishTitle="Legal notice (English translation)"
      text={legalNotice}
    />
  )
}
