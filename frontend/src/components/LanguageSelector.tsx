import { useI18n } from '../i18n/context'
import { isUiLanguage } from '../i18n/messages'
import type { UiLanguage } from '../i18n/messages'
import { HeaderMenu } from './HeaderMenu'
import { LanguageIcon } from './icons'

const languages: { value: UiLanguage; name: string }[] = [
  { value: 'en', name: 'English' },
  { value: 'de', name: 'Deutsch' },
  { value: 'ru', name: 'Русский' },
]

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n()
  return (
    <div className="max-w-sm text-sm">
      <label htmlFor="ui-language" className="block font-semibold">
        {t.uiLanguage}
      </label>
      <select
        id="ui-language"
        value={language}
        aria-describedby="ui-language-hint"
        className="mt-1 rounded border border-line bg-surface px-3 py-2"
        onChange={(event) => {
          if (isUiLanguage(event.target.value)) setLanguage(event.target.value)
        }}
      >
        {languages.map(({ value, name }) => (
          <option key={value} value={value} lang={value}>
            {name}
          </option>
        ))}
      </select>
      <p id="ui-language-hint" className="mt-1 text-muted">
        {t.languageHint}
      </p>
    </div>
  )
}

export function LanguageMenu() {
  const { language, setLanguage, t } = useI18n()
  return (
    <HeaderMenu label={t.uiLanguage} icon={<LanguageIcon />}>
      <ul className="grid gap-1">
        {languages.map(({ value, name }) => (
          <li key={value}>
            <button
              type="button"
              lang={value}
              aria-pressed={language === value}
              className="w-full rounded px-3 py-2 text-left hover:bg-canvas aria-pressed:font-bold"
              onClick={() => setLanguage(value)}
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
    </HeaderMenu>
  )
}
