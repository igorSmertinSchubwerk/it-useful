import { useLayoutEffect, useState } from 'react'
import { useI18n } from '../i18n/context'
import { readTheme, saveTheme } from '../features/theme/theme'
import { iconButtonClass } from './HeaderMenu'
import { MoonIcon, SunIcon } from './icons'

export function ThemeToggle() {
  const { t } = useI18n()
  const [theme, setTheme] = useState(readTheme)
  // Before the first paint, so a saved dark theme does not flash light.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      aria-label={t.darkMode}
      title={t.darkMode}
      aria-pressed={dark}
      className={iconButtonClass}
      onClick={() => {
        const next = dark ? 'light' : 'dark'
        setTheme(next)
        saveTheme(next)
      }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
