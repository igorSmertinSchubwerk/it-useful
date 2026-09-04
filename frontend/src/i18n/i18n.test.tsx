import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { ApiError } from '../api/errors'
import { localizeApiError } from './errors'
import { messages } from './messages'
import { readUiLanguage, UI_LANGUAGE_KEY } from './preference'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

test.each(['en', 'de', 'ru'] as const)(
  'restores %s and translates every message key',
  (language) => {
    localStorage.setItem(UI_LANGUAGE_KEY, language)
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      messages[language].homeTitle,
    )
    expect(document.documentElement.lang).toBe(language)
    expect(document.title).toBe(`${messages[language].homeTitle} | IT Useful`)
    expect(Object.keys(messages[language]).sort()).toEqual(
      Object.keys(messages.en).sort(),
    )
    expect(
      Object.values(messages[language]).every(
        (message) => message.trim().length > 0,
      ),
    ).toBe(true)
  },
)

test.each([null, 'fr', 'DE', '<script>', ''])(
  'falls back to English for preference %s',
  (stored) => {
    if (stored !== null) localStorage.setItem(UI_LANGUAGE_KEY, stored)
    expect(readUiLanguage()).toBe('en')
  },
)

test('switches the interface without changing content selection or unrelated storage', async () => {
  localStorage.setItem('content-language', 'RU')
  const { unmount } = render(
    <MemoryRouter initialEntries={['/?language=RU']}>
      <App />
    </MemoryRouter>,
  )
  expect(
    screen.getByRole('combobox', { name: 'Definition language' }),
  ).toHaveValue('RU')
  const selector = screen.getByRole('combobox', { name: 'Interface language' })
  await userEvent.setup().selectOptions(selector, 'de')
  expect(document.title).toBe('Ein Ort für dein IT-Wissen | IT Useful')
  expect(
    screen.getByRole('combobox', { name: 'Sprache der Begriffe' }),
  ).toHaveValue('RU')
  expect(localStorage.getItem(UI_LANGUAGE_KEY)).toBe('de')
  expect(localStorage.getItem('content-language')).toBe('RU')
  unmount()
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  expect(
    screen.getByRole('combobox', { name: 'Sprache der Oberfläche' }),
  ).toHaveValue('de')
})

test('keeps language switching usable when storage access is denied', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError')
  })
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  await userEvent
    .setup()
    .selectOptions(
      screen.getByRole('combobox', { name: 'Interface language' }),
      'ru',
    )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    messages.ru.homeTitle,
  )
  expect(document.documentElement.lang).toBe('ru')
})

test.each(['en', 'de', 'ru'] as const)(
  'localizes all API codes and validation paths in %s',
  (language) => {
    const codes = [
      'validation_failed',
      'malformed_request',
      'element_not_found',
      'image_not_found',
      'invalid_image',
      'duplicate_slug',
      'duplicate_image_order',
      'data_conflict',
      'upload_too_large',
      'storage_error',
      'internal_error',
      'network_error',
      'invalid_response',
    ]
    for (const code of codes) {
      const result = localizeApiError(
        new ApiError('Raw server text', 400, code, [
          { field: 'translations[0].title', message: 'must not be blank' },
        ]),
        language,
      )
      expect(Object.values(messages[language])).toContain(result.message)
      expect(result.message).not.toBe(messages[language].errorGeneric)
      expect(result.fieldErrors).toEqual([
        {
          field: 'translations[0].title',
          message: messages[language].errorField,
        },
      ])
    }
    expect(
      localizeApiError(new ApiError('<html>', 503, 'unknown'), language)
        .message,
    ).toBe(messages[language].errorServer)
    expect(localizeApiError(new Error('private text'), language).message).toBe(
      messages[language].errorGeneric,
    )
    expect(
      localizeApiError(new ApiError('raw', 400, 'constructor'), language)
        .message,
    ).toBe(messages[language].errorGeneric)
  },
)
