import { z } from 'zod'

// Mirror the backend DTOs. UUIDs and ISO timestamps remain strings in the UI.
export const languageCodeSchema = z.enum(['EN', 'DE', 'RU'])
export type LanguageCode = z.infer<typeof languageCodeSchema>
export const translationSchema = z.object({
  languageCode: languageCodeSchema,
  title: z.string(),
  content: z.string(),
  examples: z.string().nullable(),
})
export const imageSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  altText: z.string().nullable(),
  displayOrder: z.number().int().nonnegative(),
  createdAt: z.string(),
})
export const elementListSchema = z.object({
  id: z.string(),
  slug: z.string(),
  titles: z.partialRecord(languageCodeSchema, z.string()),
  updatedAt: z.string(),
})
export const elementDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  translations: z.array(translationSchema),
  images: z.array(imageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ElementListItem = z.infer<typeof elementListSchema>
export type ElementDetail = z.infer<typeof elementDetailSchema>
export type ElementImage = z.infer<typeof imageSchema>
export interface ElementWriteRequest {
  slug: string
  translations: {
    languageCode: LanguageCode
    title: string
    content: string
    examples?: string | null
  }[]
}
export interface ImageUpdateRequest {
  // Backend replaces altText even when only the order is changed.
  altText: string | null
  displayOrder?: number | null
}
export interface ImageUploadRequest {
  file: File
  altText?: string
  displayOrder?: number
}
