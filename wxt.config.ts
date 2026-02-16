import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  manifest: {
    name: 'GraphiTab',
    homepage_url: 'https://github.com/jayclassless/graphitab',
    permissions: ['storage'],
    incognito: 'split',
    browser_specific_settings: {
      gecko: {
        id: '@graphitab.classless.net',
      },
    },
  },
  autoIcons: {
    developmentIndicator: 'overlay',
  },
})
