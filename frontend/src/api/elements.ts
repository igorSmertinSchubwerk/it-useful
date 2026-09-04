import { z } from 'zod'
import { createApiClient } from './client'
import {
  elementDetailSchema,
  elementListSchema,
  imageSchema,
} from './contracts'
import type {
  ElementWriteRequest,
  ImageUpdateRequest,
  ImageUploadRequest,
} from './contracts'

export function createElementsApi(client = createApiClient()) {
  const element = (id: string) => `/elements/${encodeURIComponent(id)}`
  const image = (id: string) => `/images/${encodeURIComponent(id)}`
  return {
    list: (signal?: AbortSignal) =>
      client.request('/elements', z.array(elementListSchema), { signal }),
    get: (id: string, signal?: AbortSignal) =>
      client.request(element(id), elementDetailSchema, { signal }),
    create: (body: ElementWriteRequest, signal?: AbortSignal) =>
      client.request('/elements', elementDetailSchema, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      }),
    update: (id: string, body: ElementWriteRequest, signal?: AbortSignal) =>
      client.request(element(id), elementDetailSchema, {
        method: 'PUT',
        body: JSON.stringify(body),
        signal,
      }),
    remove: (id: string, signal?: AbortSignal) =>
      client.request(element(id), z.undefined(), { method: 'DELETE', signal }),
    uploadImage: (
      id: string,
      input: ImageUploadRequest,
      signal?: AbortSignal,
      onProgress?: (percent: number | null) => void,
    ) => {
      const body = new FormData()
      body.append('file', input.file)
      if (input.altText !== undefined) body.append('altText', input.altText)
      if (input.displayOrder !== undefined)
        body.append('displayOrder', String(input.displayOrder))
      if (onProgress)
        return client.upload(
          `${element(id)}/images`,
          imageSchema,
          body,
          onProgress,
          signal,
        )
      return client.request(`${element(id)}/images`, imageSchema, {
        method: 'POST',
        body,
        signal,
      })
    },
    updateImage: (id: string, body: ImageUpdateRequest, signal?: AbortSignal) =>
      client.request(image(id), imageSchema, {
        method: 'PATCH',
        body: JSON.stringify(body),
        signal,
      }),
    removeImage: (id: string, signal?: AbortSignal) =>
      client.request(image(id), z.undefined(), { method: 'DELETE', signal }),
    imageUrl: (id: string) => client.url(image(id)),
  }
}
