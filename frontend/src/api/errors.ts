import { z } from 'zod'

const fieldErrorSchema = z.object({ field: z.string(), message: z.string() })
export type FieldError = z.infer<typeof fieldErrorSchema>

export class ApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly fieldErrors: FieldError[]

  constructor(
    message: string,
    status: number | null,
    code: string,
    fieldErrors: FieldError[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export function httpError(status: number, body: unknown): ApiError {
  const record = z.record(z.string(), z.unknown()).safeParse(body)
  const problem = record.success ? record.data : {}
  const errors = Array.isArray(problem.errors)
    ? problem.errors.flatMap((entry) => {
        const parsed = fieldErrorSchema.safeParse(entry)
        return parsed.success ? [parsed.data] : []
      })
    : []
  const message =
    typeof problem.detail === 'string' && problem.detail.trim()
      ? problem.detail
      : `Request failed (HTTP ${status})`
  return new ApiError(
    message,
    status,
    typeof problem.code === 'string' ? problem.code : 'http_error',
    errors,
  )
}
