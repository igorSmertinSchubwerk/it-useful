import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { elementFixture } from '../src/test/elementFixture'

test('list opens selected translation and preserves search through detail, edit, and back', async ({
  page,
}) => {
  await page.route('**/api/elements', (route) =>
    route.fulfill({
      json: [
        {
          id: 'example-id',
          slug: 'http',
          titles: { DE: 'HTTP auf Deutsch' },
          updatedAt: elementFixture.updatedAt,
        },
      ],
    }),
  )
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ json: elementFixture }),
  )
  await page.goto('/?language=DE&q=http&sort=newest')
  await page
    .getByRole('link', { name: 'HTTP auf Deutsch', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'HTTP auf Deutsch' }),
  ).toBeVisible()
  await expect(page.getByText('Eine Anfrage und eine Antwort.')).toBeVisible()
  await expect(
    page.getByText('No examples have been added in this language yet.'),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Open edit preview' }).click()
  await page.getByRole('link', { name: 'Open detail preview' }).click()
  await expect(page.locator('#content-language')).toHaveValue('DE')
  await page.getByRole('link', { name: 'Back to definitions' }).click()
  await expect(page.locator('#search')).toHaveValue('http')
  await expect(page.locator('#sort')).toHaveValue('newest')
})

test('language changes are independent, survive reload, and support browser history', async ({
  page,
}) => {
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ json: elementFixture }),
  )
  await page.goto('/elements/example-id')
  await expect(
    page.getByRole('heading', { name: 'HTTP', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'How it works', level: 3 }),
  ).toBeVisible()
  await expect(page.locator('pre')).toContainText('GET / HTTP/1.1')
  await page.locator('#content-language').selectOption('RU')
  await expect(
    page.getByRole('heading', { name: 'HTTP по-русски' }),
  ).toBeVisible()
  await page.locator('#ui-language').selectOption('de')
  await expect(page.getByRole('heading', { name: 'Beispiele' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'HTTP по-русски' }),
  ).toHaveAttribute('lang', 'ru')
  await page.reload()
  await expect(page.locator('#content-language')).toHaveValue('RU')
  await page.locator('#content-language').selectOption('EN')
  await page.goBack()
  await expect(page.locator('#content-language')).toHaveValue('RU')
})

test('missing translation, blank fields, and empty gallery have clear states without fallback', async ({
  page,
}) => {
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({
      json: {
        ...elementFixture,
        translations: [
          { languageCode: 'EN', title: '', content: ' ', examples: '' },
        ],
      },
    }),
  )
  await page.goto('/elements/example-id?language=RU')
  await expect(
    page.getByText(/This translation is not available/),
  ).toBeVisible()
  await expect(page.getByText('No images have been added yet.')).toBeVisible()
  await page.locator('#content-language').selectOption('EN')
  await expect(
    page.getByText('No explanation has been added in this language yet.'),
  ).toBeVisible()
  await expect(
    page.getByText('No examples have been added in this language yet.'),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Translation missing' }),
  ).toBeVisible()
})

test('loading, server error, retry, and missing definition recover safely', async ({
  page,
}) => {
  let status = 500
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/elements/example-id', async (route) => {
    await waiting
    await route.fulfill({
      status,
      json:
        status === 200
          ? elementFixture
          : { code: status === 404 ? 'element_not_found' : 'internal_error' },
    })
  })
  await page.goto('/elements/example-id')
  await expect(page.getByText('Loading definition…')).toBeVisible()
  release()
  await expect(page.getByRole('alert')).toBeVisible()
  status = 404
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'does not exist or has been deleted',
  )
  await expect(
    page.getByRole('link', { name: 'Open edit preview' }),
  ).toHaveCount(0)
  status = 200
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'HTTP', exact: true }),
  ).toBeVisible()
})

test('refresh failure retains content but confirmed deletion removes cached content', async ({
  page,
}) => {
  let status = 200
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ status, json: status === 200 ? elementFixture : {} }),
  )
  await page.goto('/elements/example-id')
  await expect(
    page.getByRole('heading', { name: 'HTTP', exact: true }),
  ).toBeVisible()
  status = 503
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Previously loaded content is shown',
  )
  await expect(
    page.getByRole('heading', { name: 'HTTP', exact: true }),
  ).toBeVisible()
  status = 404
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('does not exist')
  await expect(
    page.getByRole('heading', { name: 'HTTP', exact: true }),
  ).toHaveCount(0)
})

test('ordered images, retry, safe Markdown, and Russian mobile accessibility', async ({
  page,
}) => {
  const image = {
    contentType: 'image/svg+xml',
    altText: null,
    createdAt: elementFixture.createdAt,
  }
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({
      json: {
        ...elementFixture,
        translations: elementFixture.translations.map((translation) => ({
          ...translation,
          content:
            translation.content +
            '\n\n<script>window.bad = true</script>\n\n[Unsafe](javascript:alert%281%29)\n\n![Remote](https://tracking.invalid/image.png)\n\n~~~\n' +
            'long'.repeat(80) +
            '\n~~~',
        })),
        images: [
          { ...image, id: 'second', fileName: 'second.svg', displayOrder: 2 },
          {
            ...image,
            id: 'first',
            fileName: 'first.svg',
            altText: 'Diagram',
            displayOrder: 1,
          },
        ],
      },
    }),
  )
  let failed = true
  await page.route('**/api/images/**', (route) =>
    failed && route.request().url().includes('first')
      ? route.fulfill({ status: 404 })
      : route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#1d4ed8"/></svg>',
        }),
  )
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/elements/example-id?language=RU')
  await page.locator('#ui-language').selectOption('ru')
  await page.locator('figure').first().scrollIntoViewIfNeeded()
  await expect(page.locator('figure').first()).toContainText('Diagram')
  await expect(
    page.getByRole('button', { name: /Загрузить изображение повторно/ }),
  ).toBeVisible()
  failed = false
  await page
    .getByRole('button', { name: /Загрузить изображение повторно/ })
    .click()
  await expect(page.getByRole('img', { name: 'Diagram' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Diagram' })).toHaveJSProperty(
    'naturalWidth',
    400,
  )
  await expect(page.getByRole('img')).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Unsafe' })).toHaveCount(0)
  expect(await page.evaluate(() => Object.hasOwn(window, 'bad'))).toBe(false)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({
    path: 'test-results/detail-mobile.png',
    fullPage: true,
  })
})
