import type { Page } from '@playwright/test'
import { messages } from '../src/i18n/messages'
import type { UiLanguage } from '../src/i18n/messages'

const names: Record<UiLanguage, string> = {
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
}

/** Picks the interface language through the header menu, whatever it shows now. */
export async function chooseInterfaceLanguage(
  page: Page,
  language: UiLanguage,
) {
  const labels = Object.values(messages).map((t) => t.uiLanguage)
  await page
    .getByRole('button', { name: new RegExp(`^(${labels.join('|')})$`) })
    .click()
  await page.getByRole('button', { name: names[language], exact: true }).click()
}
