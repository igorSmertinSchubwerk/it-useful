import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

// jsdom has no layout engine. The text editor asks for positions when it moves
// the caret, so these only need to exist. Chromium tests cover real layout.
if (typeof document !== 'undefined') {
  const noRects = () => [] as unknown as DOMRectList
  Range.prototype.getClientRects = noRects
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  Element.prototype.getClientRects = noRects
  document.elementFromPoint = () => null
  // jsdom cannot hold object URLs. Image previews only need a value to assign.
  URL.createObjectURL = () => 'blob:preview'
  URL.revokeObjectURL = () => undefined
}

// One second is too short for the editor form on a busy machine or CI runner.
configure({ asyncUtilTimeout: 5000 })

// The form loads on demand. Loading it here keeps that first load out of the
// time a test waits for a field to appear.
beforeAll(async () => {
  if (typeof document !== 'undefined')
    await import('../features/elements/ElementForm')
})
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
