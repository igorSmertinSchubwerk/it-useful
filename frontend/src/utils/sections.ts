import { matchPath } from 'react-router-dom'
import { definitionsPath } from './paths'

export type Section = 'dashboard' | 'definitions' | 'settings' | 'neutral'

/** The section whose colors a page uses. Sign-in and legal pages stay neutral. */
export function sectionOf(pathname: string): Section {
  if (matchPath({ path: '/', end: true }, pathname)) return 'dashboard'
  if (matchPath({ path: definitionsPath, end: false }, pathname))
    return 'definitions'
  if (matchPath({ path: '/settings', end: false }, pathname)) return 'settings'
  return 'neutral'
}
