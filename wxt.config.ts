import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  manifest: {
    name: 'GraphiTab',
    permissions: ['storage'],
    incognito: 'split',
  },
  autoIcons: {
    developmentIndicator: 'overlay',
  },
})
