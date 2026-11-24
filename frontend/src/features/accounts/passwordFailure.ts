import { ApiError } from '../../api/errors'
import type { Messages } from '../../i18n/messages'

/**
 * Turns a failed password request into the message the person can act on.
 */
export function describePasswordFailure(failure: unknown, t: Messages) {
  if (!(failure instanceof ApiError)) return t.authUnavailableText
  if (failure.code === 'invitation_invalid') return t.invitationInvalid
  if (failure.code === 'reset_invalid') return t.resetInvalid
  if (failure.code === 'current_password_incorrect')
    return t.currentPasswordIncorrect
  if (failure.code === 'password_rejected')
    return (
      {
        TOO_SHORT: t.passwordTooShort,
        TOO_LONG: t.passwordTooLong,
        MATCHES_EMAIL: t.passwordMatchesEmail,
        TOO_COMMON: t.passwordTooCommon,
      }[failure.violation ?? ''] ?? t.passwordTooCommon
    )
  return t.authUnavailableText
}
