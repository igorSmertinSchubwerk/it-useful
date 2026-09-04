import { expect, test } from '@playwright/test'

test('create, translate, edit, upload, reload and delete through the real API', async ({
  page,
  request,
}) => {
  // An empty catalogue guards against accidentally targeting development data.
  const initial = await request.get('/api/elements')
  expect(initial.ok()).toBe(true)
  expect(await initial.json()).toEqual([])
  await page.goto('/elements/new')
  await page.locator('#slug').fill('full-stack-definition')
  for (const [code, label] of [
    ['EN', 'English'],
    ['DE', 'Deutsch'],
    ['RU', 'Русский'],
  ]) {
    await page.getByRole('tab', { name: label, exact: true }).click()
    await page.locator(`#${code}-title`).fill(`${code} full stack`)
    await page
      .locator(`#${code}-content`)
      .fill(`## ${code} explanation\n\n**Real database**`)
    await page
      .locator(`#${code}-examples`)
      .fill('```java\nSystem.out.println("Hello");\n```')
  }
  await page
    .getByRole('button', { name: 'Save definition', exact: true })
    .click()
  await expect(page).toHaveURL(/\/elements\/[0-9a-f-]+\?/)
  const id = new URL(page.url()).pathname.split('/').at(-1)!
  await page.reload()
  for (const code of ['EN', 'DE', 'RU']) {
    await page.locator('#content-language').selectOption(code)
    await expect(
      page.getByRole('heading', { name: `${code} full stack`, exact: true }),
    ).toBeVisible()
  }
  await page.getByRole('link', { name: 'Edit definition', exact: true }).click()
  await page.locator('#RU-title').fill('RU edited')
  await page
    .getByRole('button', { name: 'Save definition', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'RU edited', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Edit definition', exact: true }).click()
  await page.locator('#image-file').setInputFiles({
    name: 'diagram.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6NxsAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await page.locator('#upload-alt').fill('Full stack diagram')
  await page.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(
    page.getByText('Image changes saved.', { exact: true }),
  ).toBeVisible()
  await page.reload()
  const saved = await (await request.get(`/api/elements/${id}`)).json()
  expect(saved.images).toHaveLength(1)
  const imageId = saved.images[0].id
  await expect(
    page.getByRole('img', { name: 'Full stack diagram', exact: true }),
  ).toHaveJSProperty('naturalWidth', 1)
  await page.locator(`#alt-${imageId}`).fill('Updated diagram')
  await page.locator(`#order-${imageId}`).fill('4')
  await page
    .getByRole('button', {
      name: 'Save image details: diagram.png',
      exact: true,
    })
    .click()
  await expect(
    page.getByText('Image changes saved.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await page.reload()
  await expect(
    page.getByRole('img', { name: 'Updated diagram', exact: true }),
  ).toHaveJSProperty('naturalWidth', 1)
  const updated = await (await request.get(`/api/elements/${id}`)).json()
  expect(updated.images[0]).toMatchObject({
    altText: 'Updated diagram',
    displayOrder: 4,
  })
  await page.getByRole('link', { name: 'Back to definitions' }).click()
  await expect(
    page.getByRole('link', { name: 'RU edited', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Delete: RU edited', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(
    page.getByText('No definitions yet.', { exact: false }),
  ).toBeVisible()
  await page.reload()
  expect(await (await request.get('/api/elements')).json()).toEqual([])
  expect((await request.get(`/api/elements/${id}`)).status()).toBe(404)
  expect((await request.get(`/api/images/${imageId}`)).status()).toBe(404)
})
