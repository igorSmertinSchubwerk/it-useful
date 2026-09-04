import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/context'

export function useRouteAccessibility() {
  const { pathname } = useLocation()
  const { language } = useI18n()
  const previousPath = useRef(pathname)
  useLayoutEffect(() => {
    const heading = document.querySelector<HTMLElement>('main h1')
    document.title = `${heading?.textContent ?? 'Page'} | IT Useful`
    if (previousPath.current !== pathname) {
      heading?.setAttribute('tabindex', '-1')
      heading?.focus()
    }
    previousPath.current = pathname
  }, [pathname, language])
}
