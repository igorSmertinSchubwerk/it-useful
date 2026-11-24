import { LegalDocument } from '../features/legal/LegalDocument'
import { privacyPolicy } from '../features/legal/legalTexts'

export function PrivacyPage() {
  return (
    <LegalDocument
      germanTitle="Datenschutzerklärung"
      englishTitle="Privacy policy (English translation)"
      text={privacyPolicy}
    />
  )
}
