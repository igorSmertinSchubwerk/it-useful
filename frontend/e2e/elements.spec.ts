import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

const records = [
  {
    id: 'alpha-id',
    slug: 'alpha',
    titles: { EN: 'Alpha', DE: 'Zebra', RU: 'Альфа' },
    updatedAt: '2026-09-01T12:00:00Z',
  },
  {
    id: 'beta-id',
    slug: 'beta',
    titles: { EN: 'Beta', DE: 'Apfel', RU: 'Бета' },
    updatedAt: '2026-09-02T12:00:00Z',
  },
  {
    id: 'missing-id',
    slug: 'missing',
    titles: { EN: 'Missing German' },
    updatedAt: '2026-09-03T12:00:00Z',
  },
]

test('table, language independence, search, sorting, history, and links', async ({
  page,
}) => {
  await page.route('**/api/elements', (route) =>
    route.fulfill({ json: records }),
  )
  await page.goto('/')
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('Alpha')
  await page.getByLabel('Sort by', { exact: true }).selectOption('newest')
  await expect(rows.first()).toContainText('Missing German')
  await page
    .getByLabel('Definition language', { exact: true })
    .selectOption('DE')
  await page.getByLabel('Search title or slug', { exact: true }).fill(' APF ')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Apfel')
  await page.getByRole('button', { name: 'Clear search and sorting' }).click()
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('Apfel')
  await expect(rows.last()).toContainText('Translation missing (missing)')
  await page
    .getByLabel('Interface language', { exact: true })
    .selectOption('ru')
  await expect(page.getByLabel('Язык терминов', { exact: true })).toHaveValue(
    'DE',
  )
  await expect(rows.first()).toContainText('Apfel')
  await page.getByRole('link', { name: 'Apfel', exact: true }).click()
  await expect(page).toHaveURL(/\/elements\/beta-id$/)
  await page.goBack()
  await expect(page.getByLabel('Язык терминов', { exact: true })).toHaveValue(
    'DE',
  )
  await page.reload()
  await expect(rows.first()).toContainText('Apfel')
  await page
    .getByRole('link', { name: 'Редактировать термин: Apfel', exact: true })
    .click()
  await expect(page).toHaveURL(/\/elements\/beta-id\/edit$/)
})

test('loading, failed request, retry, empty, and no search matches', async ({
  page,
}) => {
  let resolveRequest!: (route: Route) => void
  const requested = new Promise<Route>((resolve) => {
    resolveRequest = resolve
  })
  await page.route('**/api/elements', (route) => {
    resolveRequest(route)
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('Loading definitions')
  await (
    await requested
  ).fulfill({ status: 500, json: { code: 'internal_error' } })
  await expect(page.getByRole('alert')).toContainText(
    'The server encountered an error',
  )
  await page.unroute('**/api/elements')
  await page.route('**/api/elements', (route) => route.fulfill({ json: [] }))
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(
    page.getByText('No definitions yet.', { exact: true }),
  ).toBeVisible()
  await page.unroute('**/api/elements')
  await page.route('**/api/elements', (route) =>
    route.fulfill({ json: records }),
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await page
    .getByLabel('Search title or slug', { exact: true })
    .fill('not found')
  await expect(
    page.getByText('No matching definitions.', { exact: true }),
  ).toBeVisible()
})

test('cancel and Escape preserve data and return focus to the delete button', async ({
  page,
}) => {
  let deletes = 0
  await page.route('**/api/elements', (route) =>
    route.fulfill({ json: records }),
  )
  await page.route('**/api/elements/*', (route) => {
    deletes++
    return route.fulfill({ status: 204 })
  })
  await page.goto('/')
  const trigger = page.getByRole('button', {
    name: 'Delete: Alpha',
    exact: true,
  })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Alpha')
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(trigger).toBeFocused()
  expect(deletes).toBe(0)
  await expect(page.locator('tbody tr')).toHaveCount(3)
})

test('confirmation sends one DELETE, locks dismissal, and refreshes cached data', async ({
  page,
}) => {
  let data = [...records]
  let deletes = 0
  let reads = 0
  let resolveRequest!: (route: Route) => void
  const requested = new Promise<Route>((resolve) => {
    resolveRequest = resolve
  })
  await page.route('**/api/elements', (route) => {
    reads++
    return route.fulfill({ json: data })
  })
  await page.route('**/api/elements/alpha-id', (route) => {
    deletes++
    resolveRequest(route)
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Delete: Alpha', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('button', { name: 'Delete', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
    })
  const request = await requested
  expect(request.request().method()).toBe('DELETE')
  await expect(
    dialog.getByRole('button', { name: 'Delete', exact: true }),
  ).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  data = data.filter((item) => item.id !== 'alpha-id')
  await request.fulfill({ status: 204 })
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(
    page.getByRole('link', { name: 'Alpha', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await expect(page.getByRole('status')).toContainText('Definition deleted.')
  expect(deletes).toBe(1)
  await expect.poll(() => reads).toBeGreaterThan(1)
})

test('delete error keeps the record and allows an explicit retry', async ({
  page,
}) => {
  let deletes = 0
  let data = [...records]
  await page.route('**/api/elements', (route) => route.fulfill({ json: data }))
  await page.route('**/api/elements/alpha-id', (route) => {
    deletes++
    if (deletes === 1)
      return route.fulfill({ status: 409, json: { code: 'data_conflict' } })
    data = data.filter((item) => item.id !== 'alpha-id')
    return route.fulfill({ status: 204 })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Delete: Alpha', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'conflicts with existing data',
  )
  expect(deletes).toBe(1)
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  expect(deletes).toBe(2)
})

test('refresh failure retains data and offers recovery', async ({ page }) => {
  let reads = 0
  await page.route('**/api/elements', (route) => {
    reads++
    return reads === 1
      ? route.fulfill({ json: records })
      : route.fulfill({ status: 503, body: 'Unavailable' })
  })
  await page.goto('/')
  await expect(page.locator('tbody tr')).toHaveCount(3)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Previously loaded data is shown',
  )
  await expect(page.locator('tbody tr')).toHaveCount(3)
})

test('populated table and dialog fit mobile and remain accessible in Russian', async ({
  page,
}) => {
  await page.route('**/api/elements', (route) =>
    route.fulfill({ json: records }),
  )
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/?language=RU')
  await page
    .getByLabel('Interface language', { exact: true })
    .selectOption('ru')
  await expect(page.locator('tbody tr')).toHaveCount(3)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/elements-mobile.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Удалить: Альфа', exact: true })
    .click()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: 'test-results/delete-mobile.png',
    fullPage: true,
  })
})
