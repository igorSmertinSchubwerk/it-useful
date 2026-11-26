export type Theme = 'light' | 'dark'

export const THEME_KEY = 'it-useful.theme'

/** The saved choice, otherwise the operating system's color scheme. */
export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    /* Storage may be blocked; fall back to the system preference. */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* Storage may be blocked; the theme still switches for this visit. */
  }
}
