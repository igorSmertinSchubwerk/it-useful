import { afterEach, expect, test, vi } from 'vitest'
import { rememberReturnPath, takeReturnPath } from './returnPath'

afterEach(() => sessionStorage.clear())

test('stores one internal return path and consumes it once', () => {
  rememberReturnPath('/elements/123/edit?language=DE')
  expect(takeReturnPath()).toBe('/elements/123/edit?language=DE')
  expect(takeReturnPath()).toBeNull()
})

test.each([
  'https://attacker.example/path',
  '//attacker.example/path',
  '/\\attacker.example/path',
  '/sign-in',
  '/path\nheader',
])('rejects unsafe return path %s', (path) => {
  rememberReturnPath(path)
  expect(takeReturnPath()).toBeNull()
})

test('falls back safely when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('denied')
  })
  expect(() => rememberReturnPath('/elements/1')).not.toThrow()
})
