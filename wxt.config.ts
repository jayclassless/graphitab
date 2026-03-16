import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    optimizeDeps: {
      include: ['@microlink/react-json-view'],
    },
  }),
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  manifestVersion: 3,
  manifest: {
    name: 'GraphiTab',
    homepage_url: 'https://github.com/jayclassless/graphitab',
    permissions: ['storage'],
    host_permissions: ['<all_urls>'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
    incognito: 'split',
    browser_specific_settings: {
      gecko: {
        id: '@graphitab.classless.net',
        // @ts-expect-error WXT types don't include this valid Firefox manifest key
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
  autoIcons: {
    developmentIndicator: 'overlay',
  },
  zip: {
    excludeSources: ['coverage/**', 'test-results/**', 'playwright-report/**', 'plans/**'],
  },
})
