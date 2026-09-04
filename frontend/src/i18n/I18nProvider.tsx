import { useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { I18nContext } from './context'
import { isUiLanguage, messages } from './messages'
import type { UiLanguage } from './messages'
import { readUiLanguage, saveUiLanguage } from './preference'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setValue] = useState(readUiLanguage)
  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])
  function setLanguage(value: UiLanguage) {
    if (!isUiLanguage(value)) return
    setValue(value)
    saveUiLanguage(value)
  }
  return (
    <I18nContext.Provider
      value={{ language, setLanguage, t: messages[language] }}
    >
      {children}
    </I18nContext.Provider>
  )
}
