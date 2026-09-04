import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ElementWriteRequest } from '../src/api/contracts'
import { elementFixture } from '../src/test/elementFixture'

async function mockApi(page: Page) {
  let record = structuredClone(elementFixture)
  record.images = [
    {
      id: 'saved-image',
      fileName: 'saved.svg',
      contentType: 'image/svg+xml',
      altText: 'Existing image',
      displayOrder: 0,
      createdAt: elementFixture.createdAt,
    },
  ]
  await page.route('**/api/images/saved-image', (route) => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>',
    })
  })
  const writes: ElementWriteRequest[] = []
  await page.route('**/api/elements', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: [
          {
            id: record.id,
            slug: record.slug,
            titles: Object.fromEntries(
              record.translations.map((item) => [
                item.languageCode,
                item.title,
              ]),
            ),
            updatedAt: record.updatedAt,
          },
        ],
      })
    const body = route.request().postDataJSON() as ElementWriteRequest
    writes.push(body)
    record = {
      ...record,
      ...body,
      translations: body.translations.map((item) => ({
        ...item,
        examples: item.examples ?? null,
      })),
    }
    return route.fulfill({ status: 201, json: record })
  })
  await page.route('**/api/elements/example-id', (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as ElementWriteRequest
      writes.push(body)
      record = {
        ...record,
        ...body,
        translations: body.translations.map((item) => ({
          ...item,
          examples: item.examples ?? null,
        })),
      }
    }
    return route.fulfill({ json: record })
  })
  return writes
}
async function fillAll(page: Page) {
  await page.locator('#slug').fill('new-definition')
  for (const [code, label] of [
    ['EN', 'English'],
    ['DE', 'Deutsch'],
    ['RU', 'Русский'],
  ]) {
    await page.getByRole('tab', { name: new RegExp(label) }).click()
    await page.locator(`#${code}-title`).fill(`${code} title`)
    await page
      .locator(`#${code}-content`)
      .fill(`## ${code} heading\n\n**Explanation**`)
  }
}

test('required validation reveals language errors, focuses fields, and supports keyboard tabs', async ({
  page,
}) => {
  const writes = await mockApi(page)
  await page.goto('/elements/new')
  await page.getByRole('button', { name: 'Save definition' }).click()
  await expect(page.locator('#slug')).toBeFocused()
  await expect(
    page.getByRole('tab', { name: 'Deutsch — has errors' }),
  ).toBeVisible()
  await page.locator('#slug').fill('valid-slug')
  await page.getByRole('button', { name: 'Save definition' }).click()
  await expect(page.locator('#EN-title')).toBeFocused()
  await page.getByRole('tab', { name: /English/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: /Deutsch/ })).toBeFocused()
  await expect(page.locator('#DE-title')).toBeVisible()
  expect(writes).toHaveLength(0)
})

test('creates exactly once, renders preview and saved detail, and refreshes list', async ({
  page,
}) => {
  const writes = await mockApi(page)
  await page.goto('/elements/new')
  await fillAll(page)
  await page.locator('#RU-examples').fill('~~~js\nconsole.log(1)\n~~~')
  await expect(
    page.getByRole('region', { name: 'Markdown preview' }).locator('pre'),
  ).toContainText('console.log(1)')
  await page
    .getByRole('button', { name: 'Save definition' })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page).toHaveURL(/\/elements\/example-id\?language=RU$/)
  expect(writes).toHaveLength(1)
  expect(writes[0].translations.map((item) => item.languageCode)).toEqual([
    'EN',
    'DE',
    'RU',
  ])
  await expect(page.getByRole('heading', { name: 'RU title' })).toBeVisible()
  await expect(page.locator('pre')).toContainText('console.log(1)')
  await page.getByRole('link', { name: 'Back to definitions' }).click()
  await expect(
    page.getByRole('link', { name: 'RU title', exact: true }),
  ).toBeVisible()
})

test('edit loads all translations, preserves images and draft on UI change, and persists updates', async ({
  page,
}) => {
  const writes = await mockApi(page)
  await page.goto('/elements/example-id/edit?language=DE')
  await expect(page.locator('#DE-title')).toHaveValue('HTTP auf Deutsch')
  await page.locator('#DE-title').fill('Geändert')
  await page.locator('#ui-language').selectOption('ru')
  await expect(page.locator('#DE-title')).toHaveValue('Geändert')
  await page.getByRole('button', { name: 'Сохранить определение' }).click()
  await expect(page.getByRole('heading', { name: 'Geändert' })).toBeVisible()
  expect(writes[0]).not.toHaveProperty('images')
  await expect(page.getByRole('img', { name: 'Existing image' })).toBeVisible()
  expect(writes[0].translations[0].title).toBe('HTTP')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Geändert' })).toBeVisible()
})

test('server validation selects hidden tab and duplicate slug preserves entered values', async ({
  page,
}) => {
  await mockApi(page)
  let calls = 0
  await page.route('**/api/elements', (route) => {
    calls++
    return route.fulfill({
      status: calls === 1 ? 400 : 409,
      json:
        calls === 1
          ? {
              code: 'validation_failed',
              errors: [
                {
                  field: 'translations[1].title',
                  message: 'private server text',
                },
              ],
            }
          : { code: 'duplicate_slug' },
    })
  })
  await page.goto('/elements/new')
  await fillAll(page)
  await page.getByRole('button', { name: 'Save definition' }).click()
  await expect(page.locator('#DE-title')).toBeFocused()
  await expect(page.locator('#DE-title')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(page.getByText('private server text')).toHaveCount(0)
  await page.locator('#DE-title').fill('Corrected')
  await page.getByRole('button', { name: 'Save definition' }).click()
  await expect(page.locator('#slug')).toBeFocused()
  await expect(page.locator('#slug')).toHaveValue('new-definition')
  await expect(page.locator('#DE-title')).toHaveValue('Corrected')
  expect(calls).toBe(2)
})

test('pending save disables editing and duplicate submissions, then recovers after failure', async ({
  page,
}) => {
  await mockApi(page)
  let release!: () => void
  let calls = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/elements', async (route) => {
    calls++
    await gate
    await route.fulfill({ status: 503, json: { code: 'internal_error' } })
  })
  await page.goto('/elements/new')
  await fillAll(page)
  await page
    .getByRole('button', { name: 'Save definition' })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  await expect(page.locator('#slug')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Discard and leave' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  release()
  await expect(page.getByRole('alert')).toContainText(
    'save result could not be confirmed',
  )
  await expect(page.locator('#slug')).toBeEnabled()
  await expect(page.locator('#RU-title')).toHaveValue('RU title')
  expect(calls).toBe(1)
})

test('dirty navigation guards Cancel, header links, browser Back, and reload without losing drafts', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/')
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'New definition' })
    .click()
  await page.locator('#slug').fill('draft')
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.locator('#slug')).toHaveValue('draft')
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Definitions', exact: true })
    .click()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await page.goBack()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.locator('#slug')).toHaveValue('draft')
  const dialogPromise = page.waitForEvent('dialog')
  await page.evaluate(() => {
    setTimeout(() => window.location.reload(), 0)
  })
  const dialog = await dialogPromise
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
  await expect(page.locator('#slug')).toHaveValue('draft')
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('successful pending save closes a blocked navigation and opens the saved detail', async ({
  page,
}) => {
  await mockApi(page)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/elements', async (route) => {
    await gate
    const body = route.request().postDataJSON() as ElementWriteRequest
    await route.fulfill({ status: 201, json: { ...elementFixture, ...body } })
  })
  await page.goto('/elements/new')
  await fillAll(page)
  await page.getByRole('button', { name: 'Save definition' }).click()
  await expect(page.locator('#slug')).toBeDisabled()
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  release()
  await expect(page.getByRole('heading', { name: 'RU title' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('clean cancel navigates without warning and edit missing/error states can retry', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/elements/new')
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  let fail = true
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({
      status: fail ? 404 : 200,
      json: fail ? { code: 'element_not_found' } : elementFixture,
    }),
  )
  await page.goto('/elements/example-id/edit')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Save definition' }),
  ).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('#EN-title')).toHaveValue('HTTP')
})

test('Russian mobile form and preview are accessible and cannot execute Markdown HTML', async ({
  page,
}) => {
  await mockApi(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/elements/new?language=RU')
  await page.locator('#ui-language').selectOption('ru')
  await page
    .locator('#RU-content')
    .fill(
      '# Заголовок\n\n<script>window.injected = true</script>\n\n[Unsafe](javascript:alert%281%29)\n\n~~~\n' +
        'long'.repeat(100) +
        '\n~~~',
    )
  const preview = page.getByRole('region', { name: 'Предпросмотр Markdown' })
  await expect(
    preview.getByRole('heading', { name: 'Заголовок' }),
  ).toBeVisible()
  await expect(preview.locator('script')).toHaveCount(0)
  await expect(preview.getByRole('link', { name: 'Unsafe' })).toHaveCount(0)
  expect(await page.evaluate(() => Object.hasOwn(window, 'injected'))).toBe(
    false,
  )
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/editor-mobile.png',
    fullPage: true,
  })
})
