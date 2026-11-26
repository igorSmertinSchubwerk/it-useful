import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { elementFixture } from '../src/test/elementFixture'

const dashboardLight = 'rgb(255, 244, 234)'
const dashboardDark = 'rgb(26, 20, 17)'
const definitionsDark = 'rgb(17, 16, 41)'
const settingsDark = 'rgb(17, 19, 21)'

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

// The section wrapper paints the page, so read its color rather than the body's.
function canvas(page: Page) {
  return page
    .locator('[data-section]')
    .evaluate((node) => getComputedStyle(node).backgroundColor)
}

async function expectAccessible(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

test('dark mode is readable on every main page and survives a reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  expect(await canvas(page)).toBe(dashboardLight)

  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(
    page.getByRole('button', { name: 'Dark mode', pressed: true }),
  ).toBeVisible()
  expect(await canvas(page)).toBe(dashboardDark)
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Account' }).click()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Interface language' }).click()
  await expectAccessible(page)

  for (const [path, color] of [
    ['/it-definitions', definitionsDark],
    ['/it-definitions/example-id', definitionsDark],
    ['/it-definitions/example-id/edit', definitionsDark],
    ['/it-definitions/new', definitionsDark],
    ['/settings', settingsDark],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await canvas(page)).toBe(color)
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
  expect(await canvas(page)).toBe(dashboardDark)

  await page.getByRole('button', { name: 'Dark mode' }).click()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Dark mode', pressed: false }),
  ).toBeVisible()
  expect(await canvas(page)).toBe(dashboardLight)
})

// WCAG 2.2 asks a focus indicator for 3:1 against the surface it is drawn on.
async function focusContrast(target: Locator) {
  await target.focus()
  return target.evaluate((node) => {
    // A ring that is never drawn has no contrast at all.
    if (!node.matches(':focus-visible')) return 0
    const luminance = (color: string) => {
      const [r, g, b] = (color.match(/[\d.]+/g) ?? [])
        .slice(0, 3)
        .map((value) => {
          const channel = Number(value) / 255
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
        })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    let surface = node.parentElement
    while (
      surface &&
      getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)'
    )
      surface = surface.parentElement
    const ring = luminance(getComputedStyle(node).outlineColor)
    const ground = luminance(getComputedStyle(surface!).backgroundColor)
    return (Math.max(ring, ground) + 0.05) / (Math.min(ring, ground) + 0.05)
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: focus rings stay visible on tiles and in header panels`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.goto('/')
    await page.keyboard.press('Tab')
    for (const name of ['Open IT definitions', 'Open settings', 'HTTP'])
      expect(
        await focusContrast(page.getByRole('link', { name, exact: true })),
        name,
      ).toBeGreaterThanOrEqual(3)

    await page.goto('/it-definitions')
    await page.getByRole('button', { name: 'Interface language' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    expect(
      await focusContrast(page.getByRole('button', { name: 'English' })),
    ).toBeGreaterThanOrEqual(3)
  })
}
