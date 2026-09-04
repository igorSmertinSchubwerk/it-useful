import { isUiLanguage } from './messages'
import type { UiLanguage } from './messages'

export const UI_LANGUAGE_KEY = 'it-useful.ui-language'

export function readUiLanguage(): UiLanguage {
  try {
    const value = localStorage.getItem(UI_LANGUAGE_KEY)
    return isUiLanguage(value) ? value : 'en'
  } catch {
    return 'en'
  }
}

export function saveUiLanguage(value: UiLanguage) {
  try {
    localStorage.setItem(UI_LANGUAGE_KEY, value)
  } catch {
    /* Storage may be blocked; language switching still works for this session. */
  }
}
