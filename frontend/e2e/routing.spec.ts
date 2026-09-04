import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { elementFixture } from '../src/test/elementFixture'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ json: elementFixture }),
  )
  await page.route('**/api/elements', (route) => route.fulfill({ json: [] }))
})

const routes = [
  ['/', 'A home for your IT knowledge'],
  ['/elements/new', 'New definition'],
  ['/elements/example-id', 'Definition details'],
  ['/elements/example-id/edit', 'Edit definition'],
  ['/unknown/page', 'Page not found'],
] as const

for (const [path, title] of routes) {
  test(`direct link, refresh, and accessibility: ${path}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page).toHaveTitle(`${title} | IT Useful`)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    expect(errors).toEqual([])
  })
}

test('navigation, active links, history, and route focus', async ({ page }) => {
  await page.goto('/')
  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(
    navigation.getByRole('link', { name: 'Definitions', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await navigation.getByRole('link', { name: 'New definition' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await expect(
    navigation.getByRole('link', { name: 'New definition' }),
  ).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(routes[0][1])
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'New definition',
  )

  await page.goto('/elements/example-id')
  await page.getByRole('link', { name: 'Edit definition', exact: true }).click()
  await expect(page).toHaveURL(/\/elements\/example-id\/edit$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Definition details',
  )
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Edit definition',
  )
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Definition details',
  )
  await page.getByRole('link', { name: 'Back to definitions' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/unknown/page')
  await page.getByRole('link', { name: 'Back to definitions' }).click()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Page not found',
  )
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(routes[0][1])
})

test('skip link works by keyboard on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/routing-mobile.png',
    fullPage: true,
  })
})
