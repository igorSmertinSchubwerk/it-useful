import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { messages } from '../src/i18n/messages'

for (const language of ['en', 'de', 'ru'] as const) {
  test(`interface language ${language}: persistence, routes, focus, and accessibility`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const samples = await page
      .getByRole('region', { name: 'Content languages' })
      .textContent()
    const selector = page.getByRole('combobox')
    await selector.focus()
    // Exercise the native select with the keyboard rather than a mouse-only control.
    await page.keyboard.press('Home')
    for (let i = 0; i < ['en', 'de', 'ru'].indexOf(language); i++)
      await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(selector).toHaveValue(language)
    await expect(selector).toBeFocused()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    const t = messages[language]
    await expect(page).toHaveTitle(`${t.homeTitle} | IT Useful`)
    expect(
      await page
        .getByRole('region', { name: t.contentLanguages })
        .textContent(),
    ).toBe(samples)
    await page.reload()
    await expect(
      page.getByRole('combobox', { name: t.uiLanguage, exact: true }),
    ).toHaveValue(language)
    for (const [path, heading] of [
      ['/', t.homeTitle],
      ['/elements/new', t.create],
      ['/elements/example-id', t.detail],
      ['/elements/example-id/edit', t.edit],
      ['/unknown', t.notFound],
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
      await expect(page).toHaveTitle(`${heading} | IT Useful`)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    }
    await page.getByRole('link', { name: t.back }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.notFound)
    await page.screenshot({
      path: `test-results/language-${language}.png`,
      fullPage: true,
    })
    expect(errors).toEqual([])
  })
}

test('invalid saved language falls back to English', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('it-useful.ui-language', 'invalid'),
  )
  await page.goto('/elements/new')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'New definition',
  )
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
