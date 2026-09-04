import { useI18n } from '../i18n/context'
import { isUiLanguage } from '../i18n/messages'

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
        <option value="en" lang="en">
          English
        </option>
        <option value="de" lang="de">
          Deutsch
        </option>
        <option value="ru" lang="ru">
          Русский
        </option>
      </select>
      <p id="ui-language-hint" className="mt-1 text-muted">
        {t.languageHint}
      </p>
    </div>
  )
}
