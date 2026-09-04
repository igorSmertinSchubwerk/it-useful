import { ApiError } from '../api/errors'
import { messages } from './messages'
import type { MessageKey, UiLanguage } from './messages'

const errorKeys: Record<string, MessageKey> = {
  validation_failed: 'errorValidation',
  malformed_request: 'errorMalformed',
  element_not_found: 'errorElementMissing',
  image_not_found: 'errorImageMissing',
  invalid_image: 'errorImage',
  duplicate_slug: 'errorSlug',
  duplicate_image_order: 'errorOrder',
  data_conflict: 'errorConflict',
  upload_too_large: 'errorUpload',
  storage_error: 'errorStorage',
  internal_error: 'errorServer',
  network_error: 'errorNetwork',
  invalid_response: 'errorResponse',
}

// Never display unlocalized server text as an interface message.
export function localizeApiError(error: unknown, language: UiLanguage) {
  const t = messages[language]
  if (!(error instanceof ApiError))
    return { message: t.errorGeneric, fieldErrors: [] }
  const key = Object.hasOwn(errorKeys, error.code)
    ? errorKeys[error.code]
    : undefined
  const fallback =
    error.status !== null && error.status >= 500
      ? 'errorServer'
      : 'errorGeneric'
  return {
    message: t[key ?? fallback],
    fieldErrors: error.fieldErrors.map(({ field }) => ({
      field,
      message: t.errorField,
    })),
  }
}
