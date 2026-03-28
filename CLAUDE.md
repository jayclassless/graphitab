# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

GraphiTab is a browser extension (Chrome/Firefox) that provides GraphiQL (a GraphQL IDE) in a new tab. Built with WXT (Web Extension Tools), React 19, and GraphiQL 5.

## Commands

- `pnpm dev` — start dev mode (Chrome)
- `pnpm dev:firefox` — start dev mode (Firefox)
- `pnpm build` — production build (Chrome)
- `pnpm build:firefox` — production build (Firefox)
- `pnpm test` — type-check then run unit tests
- `pnpm vitest run utils/__tests__/profiles.test.ts` — run a single test file (skips type-check)
- `pnpm test:e2e` — build extension then run Playwright E2E tests
- `pnpm compile` — TypeScript type checking (`tsc --noEmit`)
- `pnpm lint` — lint with oxlint
- `pnpm format` — format with oxfmt
- `pnpm fullcheck` — run compile + lint + format + test with coverage (use before submitting PRs)

## Architecture

The extension has four entrypoints, each a standalone React app (plus a background script):

- **`entrypoints/popup/`** — The browser action popup. Manages profiles (name + GraphQL endpoint URL + optional headers). Each profile links to the GraphiQL page via query param (`/graphiql.html?profile=<id>`).
- **`entrypoints/graphiql/`** — The main GraphiQL page, opened in a new tab. Reads the `profile` query param, loads the profile, and renders GraphiQL with the Explorer plugin and a custom Saved Queries plugin. Uses Monaco editor workers bundled by `scripts/bundle-workers.mjs` (runs as a prebuild step).
- **`entrypoints/devtools/`** — Registers the DevTools panel via `browser.devtools.panels.create()`.
- **`entrypoints/devtools-panel/`** — A GraphQL network inspector in Chrome/Firefox DevTools. Captures requests via `browser.devtools.network.onRequestFinished`, displays them in a virtualized grid (react-window) with resizable columns, and provides a modal for inspecting headers, request bodies, and responses. Supports POST/GET and batched GraphQL requests. Includes copy-as-cURL, operation type filters, and dark mode detection.
- **`entrypoints/background.ts`** — Extension background/service worker.

Tests live in `__tests__/` directories alongside their source files.

### WXT Patterns

- **Auto-imports:** Use `#imports` to import WXT utilities like `storage` and `browser`
- **Typed storage:** `storage.defineItem()` creates typed, reactive storage items with fallback values
- **Reactive updates:** `storage.watch()` enables cross-tab/popup reactive updates (used in GraphiQL to detect profile changes)
- **Browser API:** Import from `wxt/browser` for cross-browser compatibility
- **Testing mock:** `fakeBrowser` from `wxt/testing` mocks browser APIs in unit tests

### State Management

React hooks only — no external state library. `browser.storage.sync` (via WXT) is the source of truth. Components use `storage.watch()` for reactive cross-tab updates. IDs are generated with the `uuid` package.

## Testing

**Unit tests:** Vitest with jsdom environment. Uses `@testing-library/react` and `@testing-library/user-event` for component tests. Browser APIs are mocked with `fakeBrowser` from `wxt/testing/fake-browser` (NOT `wxt/testing` — the full re-export loads esbuild and breaks jsdom's TextEncoder). Coverage thresholds are 95% for lines, functions, branches, and statements.

**E2E tests:** Playwright in `e2e/`. A custom fixture (`e2e/fixtures.ts`) loads the built extension into Chrome.

## Styling

Pure CSS (no preprocessor or CSS-in-JS). Uses GraphiQL's CSS custom properties for theming (spacing, colors, alpha, border-radius, font). See `styles/shared.css` for the full set of variables and shared classes (`.gt-*` prefix). Component-specific CSS is co-located with its component.

## Requirements

- No code change is considered complete unless tests have been added or updated to address the changes, the full test suite passes, the linter reports no errors, and the code is properly formatted.
- Styling for UI components should mimic that of GraphiQL's UI design whenever possible, using the CSS variables and shared classes described above.
- All React components should be in their own module.
