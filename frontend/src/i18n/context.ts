import { createContext, useContext } from 'react'
import type { Messages, UiLanguage } from './messages'

export const I18nContext = createContext<{
  language: UiLanguage
  setLanguage: (language: UiLanguage) => void
  t: Messages
} | null>(null)

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n requires I18nProvider')
  return context
}
