import { expect, test } from '@playwright/test'

const phase = process.env.ACCEPTANCE_PHASE
const slug = process.env.ACCEPTANCE_SLUG

if (!phase || !slug) throw new Error('Use scripts/test-acceptance.sh')

const titles = {
  EN: 'Acceptance definition',
  DE: 'Akzeptanzbegriff',
  RU: 'Приёмочное определение',
} as const

async function fillDefinition(page: import('@playwright/test').Page) {
  await page.locator('#slug').fill(slug!)
  for (const [code, label] of [
    ['EN', 'English'],
    ['DE', 'Deutsch'],
    ['RU', 'Русский'],
  ] as const) {
    await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click()
    await page.locator(`#${code}-title`).fill(titles[code])
    await page
      .locator(`#${code}-content`)
      .fill(`## ${titles[code]}\n\nContent stored in ${code}.`)
    await page
      .locator(`#${code}-examples`)
      .fill(`\`\`\`text\n${code} acceptance example\n\`\`\``)
  }
}

test('seed the complete workflow and validate rejected input', async ({
  page,
  request,
}) => {
  test.skip(phase !== 'seed')
  test.setTimeout(120_000)

  const initial = await request.get('/api/elements')
  expect(initial.ok()).toBe(true)
  expect(await initial.json()).toEqual([])

  await page.goto('/elements/new')
  await page.getByRole('button', { name: 'Save definition' }).click()
  await expect(page.locator('#slug')).toBeFocused()
  await expect(page.getByRole('alert')).toContainText('Check the marked fields')

  await fillDefinition(page)
  await page
    .getByRole('button', { name: 'Save definition', exact: true })
    .click()
  await expect(page).toHaveURL(/\/elements\/[0-9a-f-]+\?language=RU$/)
  const id = new URL(page.url()).pathname.split('/').at(-1)!

  for (const code of ['EN', 'DE', 'RU'] as const) {
    await page.locator('#content-language').selectOption(code)
    await expect(
      page.getByRole('heading', {
        name: titles[code],
        exact: true,
        level: 2,
      }),
    ).toBeVisible()
    await expect(page.locator('pre')).toContainText(
      `${code} acceptance example`,
    )
  }

  await page.getByRole('link', { name: 'Edit definition', exact: true }).click()
  await page.locator('#RU-title').fill('Приёмочное определение — изменено')

  for (const file of [
    {
      name: 'invalid.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    },
    {
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    },
    {
      name: 'corrupt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    },
  ]) {
    await page.locator('#image-file').setInputFiles(file)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Upload image', exact: true }),
    ).toBeDisabled()
  }

  await page.locator('#image-file').setInputFiles({
    name: 'acceptance.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6NxsAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await page.locator('#upload-alt').fill('Acceptance diagram')
  await page.getByRole('button', { name: 'Upload image', exact: true }).click()
  await expect(
    page.getByText('Image changes saved.', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Save definition', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Приёмочное определение — изменено',
      exact: true,
    }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Back to definitions' }).click()
  await page.getByLabel('Search title or slug', { exact: true }).fill(slug!)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr')).toContainText(slug!)

  await page.goto('/elements/00000000-0000-0000-0000-000000000000')
  await expect(page.getByRole('alert')).toContainText(
    'does not exist or has been deleted',
  )

  await page.goto('/elements/new')
  await fillDefinition(page)
  await page
    .getByRole('button', { name: 'Save definition', exact: true })
    .click()
  await expect(page.locator('#slug')).toBeFocused()
  await expect(page.locator('#slug-error')).toContainText(
    'This slug is already in use',
  )

  const saved = await (await request.get(`/api/elements/${id}`)).json()
  expect(saved.slug).toBe(slug)
  expect(saved.images).toHaveLength(1)
})

test('shows a recoverable error while the backend is unavailable', async ({
  page,
}) => {
  test.skip(phase !== 'outage')
  test.setTimeout(75_000)
  await page.goto('/')
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 70_000 })
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toBeVisible()
})

test('retains content after restart, permits editing, and deletes cleanly', async ({
  page,
  request,
}) => {
  test.skip(phase !== 'verify')

  const records = (await (await request.get('/api/elements')).json()) as Array<{
    id: string
    slug: string
  }>
  const record = records.find((candidate) => candidate.slug === slug)
  expect(record).toBeDefined()

  const saved = await (await request.get(`/api/elements/${record!.id}`)).json()
  expect(saved.translations).toHaveLength(3)
  expect(saved.images).toHaveLength(1)
  const imageId = saved.images[0].id as string

  await page.goto(`/elements/${record!.id}`)
  for (const [code, expectedTitle] of [
    ['EN', titles.EN],
    ['DE', titles.DE],
    ['RU', 'Приёмочное определение — изменено'],
  ] as const) {
    await page.locator('#content-language').selectOption(code)
    await expect(
      page.getByRole('heading', {
        name: expectedTitle,
        exact: true,
        level: 2,
      }),
    ).toBeVisible()
    await expect(page.locator('pre')).toContainText(
      `${code} acceptance example`,
    )
  }
  await expect(
    page.getByRole('img', { name: 'Acceptance diagram', exact: true }),
  ).toHaveJSProperty('naturalWidth', 1)

  await page.getByRole('link', { name: 'Edit definition', exact: true }).click()
  await page.getByRole('tab', { name: 'Deutsch', exact: true }).click()
  await page.locator('#DE-title').fill('Akzeptanzbegriff — nach Neustart')
  await page
    .getByRole('button', { name: 'Save definition', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Akzeptanzbegriff — nach Neustart',
      exact: true,
    }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Back to definitions' }).click()
  await page.getByLabel('Search title or slug', { exact: true }).fill(slug!)
  await page
    .getByRole('button', {
      name: `Delete: Akzeptanzbegriff — nach Neustart`,
      exact: true,
    })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(
    page.getByText('No definitions yet.', { exact: true }),
  ).toBeVisible()
  expect((await request.get(`/api/elements/${record!.id}`)).status()).toBe(404)
  expect((await request.get(`/api/images/${imageId}`)).status()).toBe(404)
})
