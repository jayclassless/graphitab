# GraphiTab

A browser extension (for both [Chrome](https://chromewebstore.google.com/detail/graphitab/cdnbebabankmpeacfgnobmgogoedpmgo) & [Firefox](https://addons.mozilla.org/en-US/firefox/addon/graphitab/)) that gives you a full [GraphiQL](https://github.com/graphql/graphiql) IDE in a new tab. Click the extension icon to manage your GraphQL endpoint profiles, then open any profile to get an interactive GraphiQL session with the Explorer plugin and saved queries. Includes the GraphQL Explorer plugin that can help you generate queries by navigating the schema, as well as a custom plugin that allows you to save queries for reuse in the future.

## Prerequisites

- [Node.js](https://nodejs.org/) v24.13.0
- [pnpm](https://pnpm.io/) v10.28.2 — after installing Node.js, enable pnpm via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`

If you have `asdf` available, you can run `asdf install` to activate the necessary tools.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev              # Start dev server (Chrome)
pnpm dev:firefox      # Start dev server (Firefox)
```

## Building

```bash
pnpm build            # Production build (Chrome)
pnpm build:firefox    # Production build (Firefox)
pnpm zip              # Package for Chrome
pnpm zip:firefox      # Package for Firefox
```

## Testing

```bash
pnpm test             # Type-check and run unit tests
pnpm test:coverage    # Run unit tests with coverage
pnpm test:e2e         # Build extension and run Playwright e2e tests
```

## Tech Stack

- [React 19](https://react.dev/)
- [WXT](https://wxt.dev/)
- [GraphiQL 5](https://github.com/graphql/graphiql)
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)

## License

MIT
