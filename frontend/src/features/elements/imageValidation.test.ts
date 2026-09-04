import { expect, test } from 'vitest'
import {
  imageMetadataError,
  maxImageBytes,
  nextImageOrder,
  validateImageFile,
} from './imageValidation'
import type { ElementImage } from '../../api/contracts'
const image: ElementImage = {
  id: 'one',
  fileName: 'one.png',
  contentType: 'image/png',
  displayOrder: 0,
  altText: null,
  createdAt: '',
}
test.each(['image/jpeg', 'image/png', 'image/webp'])(
  'accepts %s at the size limit',
  (type) => {
    expect(validateImageFile({ type, size: maxImageBytes })).toBeUndefined()
  },
)
test.each(['image/svg+xml', 'image/gif', 'text/plain', ''])(
  'rejects %s',
  (type) => {
    expect(validateImageFile({ type, size: 1 })).toBe('imageFileType')
  },
)
test.each([0, maxImageBytes + 1])('rejects invalid size %s', (size) => {
  expect(validateImageFile({ type: 'image/png', size })).toBe('imageFileSize')
})
test('validates metadata using Java length and integer limits', () => {
  expect(imageMetadataError('a'.repeat(500), '2147483647', [])).toBeUndefined()
  expect(imageMetadataError('😀'.repeat(251), '0', [])).toBe('imageAltLimit')
  for (const order of ['', '-1', '1.5', 'NaN', '2147483648'])
    expect(imageMetadataError('', order, [])).toBe('imageOrderRule')
})
test('rejects occupied positions but allows keeping the same image position', () => {
  expect(imageMetadataError('', '0', [image])).toBe('errorOrder')
  expect(imageMetadataError('', '0', [image], 'one')).toBeUndefined()
})
test('chooses the next position without integer overflow', () => {
  expect(nextImageOrder([])).toBe('0')
  expect(nextImageOrder([image])).toBe('1')
  expect(
    nextImageOrder([image, { ...image, id: 'two', displayOrder: 2147483647 }]),
  ).toBe('1')
})
