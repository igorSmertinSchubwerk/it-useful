import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { elementFixture } from '../src/test/elementFixture'

const darkCanvas = 'rgb(15, 23, 42)'
const lightCanvas = 'rgb(247, 248, 250)'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ json: elementFixture }),
  )
  await page.route('**/api/elements', (route) =>
    route.fulfill({
      json: [
        {
          id: 'example-id',
          slug: elementFixture.slug,
          titles: { EN: 'HTTP' },
          updatedAt: '2026-03-01T10:00:00Z',
        },
      ],
    }),
  )
})

function canvas(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

async function expectAccessible(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

test('dark mode is readable on every main page and survives a reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  expect(await canvas(page)).toBe(lightCanvas)

  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(
    page.getByRole('button', { name: 'Dark mode', pressed: true }),
  ).toBeVisible()
  expect(await canvas(page)).toBe(darkCanvas)
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Account' }).click()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Interface language' }).click()
  await expectAccessible(page)

  for (const path of [
    '/it-definitions',
    '/it-definitions/example-id',
    '/it-definitions/example-id/edit',
    '/it-definitions/new',
    '/settings',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await canvas(page)).toBe(darkCanvas)
    await expectAccessible(page)
  }
})

test('without a saved choice the system color scheme decides', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Dark mode', pressed: true }),
  ).toBeVisible()
  expect(await canvas(page)).toBe(darkCanvas)

  await page.getByRole('button', { name: 'Dark mode' }).click()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Dark mode', pressed: false }),
  ).toBeVisible()
  expect(await canvas(page)).toBe(lightCanvas)
})
