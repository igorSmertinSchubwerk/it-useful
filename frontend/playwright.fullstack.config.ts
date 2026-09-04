import { defineConfig, devices } from '@playwright/test'

if (!process.env.E2E_BACKEND_ORIGIN)
  throw new Error('Use scripts/test-full-stack.sh')
export default defineConfig({
  testDir: './e2e-fullstack',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  outputDir: 'test-results/fullstack',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/fullstack', open: 'never' }],
  ],
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'npm run build && npx vite preview --config vite.fullstack.config.ts --port 4175',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
