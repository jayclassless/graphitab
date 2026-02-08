import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing'

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    coverage: {
      provider: 'v8',
      include: ['utils/**/*.ts', 'entrypoints/**/*.tsx'],
      exclude: ['**/main.tsx', '**/__tests__/**'],
    },
  },
})
