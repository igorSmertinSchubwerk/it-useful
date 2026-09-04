import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ElementImage } from '../src/api/contracts'
import { elementFixture } from '../src/test/elementFixture'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=',
  'base64',
)
const first: ElementImage = {
  id: 'first',
  fileName: 'first.png',
  contentType: 'image/png',
  altText: 'First image',
  displayOrder: 0,
  createdAt: elementFixture.createdAt,
}
async function mockImages(page: Page) {
  let images = [
    first,
    {
      ...first,
      id: 'second',
      fileName: 'second.png',
      altText: null,
      displayOrder: 1,
    },
  ]
  const writes: { method: string; body: string | null }[] = []
  await page.route('**/api/elements', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/elements/example-id', (route) => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: { ...elementFixture, images } })
  })
  await page.route('**/api/elements/example-id/images', (route) => {
    writes.push({ method: 'POST', body: route.request().postData() })
    const uploaded = {
      ...first,
      id: 'uploaded',
      fileName: 'upload.png',
      altText: 'Uploaded alt',
      displayOrder: 2,
    }
    images = [...images, uploaded]
    return route.fulfill({ status: 201, json: uploaded })
  })
  await page.route('**/api/images/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)
    const method = route.request().method()
    if (method === 'GET')
      return route.fulfill({ contentType: 'image/png', body: png })
    writes.push({ method, body: route.request().postData() })
    if (method === 'DELETE') {
      images = images.filter((image) => image.id !== id)
      return route.fulfill({ status: 204 })
    }
    const body = route.request().postDataJSON()
    images = images.map((image) =>
      image.id === id ? { ...image, ...body } : image,
    )
    return route.fulfill({ json: images.find((image) => image.id === id) })
  })
  return writes
}
async function choose(page: Page) {
  await page
    .locator('#image-file')
    .setInputFiles({ name: 'upload.png', mimeType: 'image/png', buffer: png })
  await expect(
    page.getByRole('button', { name: 'Upload image', exact: true }),
  ).toBeEnabled()
}

test('new definitions explain save-first workflow without an upload request', async ({
  page,
}) => {
  await mockImages(page)
  await page.goto('/elements/new')
  await expect(page.getByText(/Save the definition first/)).toBeVisible()
  await expect(page.locator('#image-file')).toHaveCount(0)
})
test('upload previews a file, sends multipart once, refreshes gallery and detail', async ({
  page,
}) => {
  const writes = await mockImages(page)
  await page.goto('/elements/example-id/edit')
  await choose(page)
  await expect(
    page.getByRole('img', { name: 'Selected image preview' }),
  ).toBeVisible()
  await page.locator('#upload-alt').fill('Uploaded alt')
  await expect(
    page.getByRole('button', { name: 'Save definition', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Upload image', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.locator('[data-image-id]')).toHaveCount(3)
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toContain('name="file"; filename="upload.png"')
  expect(writes[0].body).toContain('Uploaded alt')
  expect(writes[0].body).toContain('name="displayOrder"')
  await expect(
    page.getByRole('img', { name: 'Selected image preview' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Save definition', exact: true }),
  ).toBeEnabled()
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('img', { name: 'Uploaded alt' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('img', { name: 'Uploaded alt' })).toBeVisible()
})
test('rejects type, empty/oversized/corrupt files and invalid metadata without writing', async ({
  page,
}) => {
  const writes = await mockImages(page)
  await page.goto('/elements/example-id/edit')
  for (const file of [
    {
      name: 'bad.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    },
    { name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) },
    {
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    },
    {
      name: 'corrupt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('broken'),
    },
  ]) {
    await page.locator('#image-file').setInputFiles(file)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Upload image', exact: true }),
    ).toBeDisabled()
  }
  await choose(page)
  await page.locator('#upload-alt').fill('x'.repeat(501))
  await page.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('500')
  await page.locator('#upload-alt').fill('valid')
  await page.locator('#upload-order').fill('0')
  await page.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(writes).toHaveLength(0)
})
test('metadata update preserves alt text while reordering and keeps definition draft', async ({
  page,
}) => {
  const writes = await mockImages(page)
  await page.goto('/elements/example-id/edit')
  await page.locator('#EN-title').fill('Unsaved title')
  await page.locator('#order-first').fill('3')
  await page
    .getByRole('button', { name: 'Save image details: first.png', exact: true })
    .click()
  await expect(page.locator('[data-image-id]').last()).toHaveAttribute(
    'data-image-id',
    'first',
  )
  expect(JSON.parse(writes[0].body!)).toEqual({
    altText: 'First image',
    displayOrder: 3,
  })
  await page.locator('#alt-first').fill('Changed alt')
  await page
    .getByRole('button', { name: 'Save image details: first.png', exact: true })
    .click()
  await expect(page.getByRole('img', { name: 'Changed alt' })).toBeVisible()
  await expect(page.locator('#EN-title')).toHaveValue('Unsaved title')
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page.getByRole('img', { name: 'Changed alt' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'HTTP', exact: true }),
  ).toBeVisible()
})
test('delete Cancel/Escape preserve the image; confirm deletes once and restores focus', async ({
  page,
}) => {
  const writes = await mockImages(page)
  await page.goto('/elements/example-id/edit')
  const trigger = page.getByRole('button', {
    name: 'Delete image: first.png',
    exact: true,
  })
  await trigger.click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Cancel' }),
  ).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(writes).toHaveLength(0)
  await trigger.click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete image', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.locator('[data-image-id]')).toHaveCount(1)
  await expect(
    page.getByRole('heading', { name: 'Manage images' }),
  ).toBeFocused()
  expect(writes.map((write) => write.method)).toEqual(['DELETE'])
})
test('pending upload blocks competing writes/navigation and exposes progress, then recovers from failure', async ({
  page,
}) => {
  await mockImages(page)
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/elements/example-id/images', async (route) => {
    calls++
    await gate
    await route.fulfill({ status: 503, json: { code: 'internal_error' } })
  })
  await page.goto('/elements/example-id/edit')
  await choose(page)
  await page.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(page.locator('#EN-title')).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Delete image: first.png' }),
  ).toBeDisabled()
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Discard and leave' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  release()
  await expect(page.getByRole('alert')).toContainText(
    'result could not be confirmed',
  )
  await expect(
    page.getByRole('button', { name: 'Upload image', exact: true }),
  ).toBeEnabled()
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'Discard image drafts' }).click()
  await page.getByRole('button', { name: 'Refresh images' }).click()
  await expect(page.locator('[data-image-id]')).toHaveCount(2)
})
test('server conflicts and delete failures keep images and allow explicit retry', async ({
  page,
}) => {
  await mockImages(page)
  let fail = true
  await page.route('**/api/images/first', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ contentType: 'image/png', body: png })
      : route.fulfill({
          status: fail ? 409 : 204,
          json: fail ? { code: 'duplicate_image_order' } : undefined,
        }),
  )
  await page.goto('/elements/example-id/edit')
  await page.locator('#order-first').fill('5')
  await page
    .getByRole('button', { name: 'Save image details: first.png' })
    .click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('#order-first')).toHaveValue('5')
  await page.getByRole('button', { name: 'Discard image drafts' }).click()
  await page.getByRole('button', { name: 'Delete image: first.png' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete image', exact: true })
    .click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(page.locator('[data-image-id]')).toHaveCount(2)
  fail = false
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete image', exact: true })
    .click()
  await expect(page.locator('[data-image-id]')).toHaveCount(1)
})
test('image drafts trigger navigation warning; Russian mobile manager is accessible', async ({
  page,
}) => {
  await mockImages(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/elements/example-id/edit')
  await page.locator('#alt-first').fill('Draft alt')
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.locator('#alt-first')).toHaveValue('Draft alt')
  await page.locator('#ui-language').selectOption('ru')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page
    .getByRole('heading', { name: 'Управление изображениями' })
    .scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/images-mobile.png' })
})
