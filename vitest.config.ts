import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing'

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['vitest-localstorage-mock'],
    coverage: {
      provider: 'v8',
      include: ['utils/**/*.ts', 'entrypoints/**/*.{ts,tsx}', 'components/**/*.tsx'],
      exclude: ['**/main.tsx', '**/__tests__/**'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
})
