import type { ElementImage } from '../../api/contracts'

export const maxImageBytes = 10 * 1024 * 1024
export function validateImageFile(
  file: Pick<File, 'size' | 'type'>,
): 'imageFileType' | 'imageFileSize' | undefined {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'imageFileType'
  if (file.size <= 0 || file.size > maxImageBytes) return 'imageFileSize'
}
export function imageMetadataError(
  alt: string,
  order: string,
  images: ElementImage[],
  id?: string,
): 'imageAltLimit' | 'imageOrderRule' | 'errorOrder' | undefined {
  if (alt.length > 500) return 'imageAltLimit'
  if (
    !/^\d+$/.test(order) ||
    !Number.isSafeInteger(Number(order)) ||
    Number(order) > 2_147_483_647
  )
    return 'imageOrderRule'
  if (
    images.some(
      (image) => image.id !== id && image.displayOrder === Number(order),
    )
  )
    return 'errorOrder'
}
export function nextImageOrder(images: ElementImage[]): string {
  const used = new Set(images.map((image) => image.displayOrder))
  const next = Math.max(-1, ...used) + 1
  if (next <= 2_147_483_647) return String(next)
  let gap = 0
  while (used.has(gap)) gap++
  return String(gap)
}
