import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { elementFixture } from '../src/test/elementFixture'

test.describe.configure({ mode: 'parallel' })

const longWord = 'VeryLongDefinition'.repeat(12)
const fixture = {
  ...elementFixture,
  slug: 'long-definition',
  translations: elementFixture.translations.map((translation) => ({
    ...translation,
    title: longWord,
    content: `# Heading\n\n${longWord}\n\n[${longWord}](https://example.com)`,
    examples: `~~~\n${longWord.repeat(4)}\n~~~`,
  })),
  images: [
    {
      id: 'diagram',
      fileName: `${longWord}.png`,
      altText: longWord,
      contentType: 'image/png',
      displayOrder: 0,
      createdAt: elementFixture.createdAt,
    },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/elements', (route) =>
    route.fulfill({
      json: [
        {
          id: fixture.id,
          slug: fixture.slug,
          updatedAt: fixture.updatedAt,
          titles: { EN: longWord, DE: longWord, RU: longWord },
        },
      ],
    }),
  )
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ json: fixture }),
  )
  // Deliberately exercise the failed-image fallback and its long retry label.
  await page.route('**/api/images/**', (route) =>
    route.fulfill({ status: 404 }),
  )
})

async function tabTo(page: Page, selector: string) {
  for (let index = 0; index < 80; index++) {
    await page.keyboard.press('Tab')
    if (
      await page
        .locator(selector)
        .evaluate((node) => node === document.activeElement)
    )
      return
  }
  throw new Error(`Keyboard could not reach ${selector}`)
}

for (const language of ['en', 'de', 'ru']) {
  for (const width of [320, 768, 1440]) {
    test(`${language}: long content reflows at ${width}px with reduced motion`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript(
        (value) => localStorage.setItem('it-useful.ui-language', value),
        language,
      )
      for (const path of [
        '/',
        '/elements/example-id',
        '/elements/new',
        '/elements/example-id/edit',
      ]) {
        await page.goto(path)
        await expect(page.locator('h1')).toBeVisible()
        if (path.endsWith('/edit'))
          await expect(page.locator('#image-manager-heading')).toBeVisible()
        if (path === '/') await expect(page.locator('table')).toBeVisible()
        if (path === '/elements/example-id')
          await expect(page.locator('figure')).toBeVisible()
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          path,
        ).toBeLessThanOrEqual(width)
        // No clipping hidden inside cards/dialogs; only tables and preformatted code may scroll.
        const overflow = await page
          .locator('article, section, fieldset, figure, dialog[open]')
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => node.scrollWidth > node.clientWidth + 1)
              .map((node) => node.tagName + ':' + node.className),
          )
        expect(overflow, path).toEqual([])
        expect(
          (await new AxeBuilder({ page }).analyze()).violations,
          path,
        ).toEqual([])
        if (path.endsWith('/edit')) {
          await page.locator('#image-manager-heading').scrollIntoViewIfNeeded()
          await page.screenshot({
            path: `test-results/ux-${language}-${width}.png`,
          })
        }
        if (language === 'en') {
          await page.locator('h1').scrollIntoViewIfNeeded()
          await page.screenshot({
            path: `test-results/ux-page-${width}-${path.replaceAll('/', '_') || 'list'}.png`,
          })
        }
      }
    })
  }
}

test('keyboard reaches table actions, traps dialog focus, edits and returns without losing focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await tabTo(page, '[role="region"]')
  const outline = await page
    .locator('[role="region"]')
    .evaluate((node) => getComputedStyle(node).outlineStyle)
  expect(outline).toBe('solid')
  await tabTo(page, 'tbody button')
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    dialog.getByRole('button', { name: 'Delete', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab')
    // Native dialog may move focus to browser chrome, but never background controls.
    expect(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          !!document.activeElement?.closest('dialog[open]'),
      ),
    ).toBe(true)
  }
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('tbody button')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/edit$/)
  await expect(page.locator('h1')).toBeFocused()
  await tabTo(page, '#slug')
  await page.keyboard.press('End')
  await page.keyboard.type('-draft')
  await tabTo(page, 'a[href="/elements/example-id"]')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#slug')).toHaveValue('long-definition-draft')
  await expect(page.locator('a[href="/elements/example-id"]')).toBeFocused()
})

test('form boundaries have contrast and reduced-motion suppresses transitions', async ({
  page,
}) => {
  await page.goto('/elements/new')
  const colors = await page.locator('#slug').evaluate((node) => {
    const style = getComputedStyle(node)
    return { border: style.borderTopColor, background: style.backgroundColor }
  })
  const luminance = (rgb: string) => {
    const channels = rgb
      .match(/\d+/g)!
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4
      })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const border = luminance(colors.border)
  const background = luminance(colors.background)
  expect(
    (Math.max(border, background) + 0.05) /
      (Math.min(border, background) + 0.05),
  ).toBeGreaterThanOrEqual(3)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Test-only probe ensures future transitions cannot ignore the preference.
  await page.locator('#slug').evaluate((node) => {
    node.style.transition = 'color 2s'
  })
  expect(
    await page
      .locator('#slug')
      .evaluate((node) =>
        parseFloat(getComputedStyle(node).transitionDuration),
      ),
  ).toBeLessThan(0.001)
  await page.setViewportSize({ width: 320, height: 700 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320)
})
