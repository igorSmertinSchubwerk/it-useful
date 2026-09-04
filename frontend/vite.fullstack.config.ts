import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.ts'

const target = process.env.E2E_BACKEND_ORIGIN
if (!target || !/^http:\/\/127\.0\.0\.1:\d+$/.test(target)) {
  throw new Error(
    'Run scripts/test-full-stack.sh to create an isolated backend.',
  )
}
export default mergeConfig(
  base,
  defineConfig({
    server: { proxy: { '/api': { target } } },
    preview: { proxy: { '/api': { target } } },
  }),
)
