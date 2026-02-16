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
- `pnpm test -- utils/__tests__/profiles.test.ts` — run a single test file
- `pnpm test:e2e` — build extension then run Playwright E2E tests
- `pnpm compile` — TypeScript type checking (`tsc --noEmit`)
- `pnpm lint` — lint with oxlint
- `pnpm format` — format with oxfmt

## Directory Structure

```
entrypoints/
  popup/           # Browser action popup (profile management)
  graphiql/        # Main GraphiQL page (opened in new tab)
  background.ts    # Extension background script
components/        # Shared React components (e.g., ConfirmDeleteButton)
utils/             # Storage utilities and helpers
styles/
  shared.css       # Shared component styles (.gt-* prefix)
e2e/               # Playwright E2E tests
assets/            # Extension assets (icon)
```

Tests live in `__tests__/` directories alongside their source files.

## Architecture

The extension has two entrypoints, each a standalone React app:

- **`entrypoints/popup/`** — The browser action popup. Manages profiles (name + GraphQL endpoint URL + optional headers). Each profile links to the GraphiQL page via query param (`/graphiql.html?profile=<id>`).
- **`entrypoints/graphiql/`** — The main GraphiQL page, opened in a new tab. Reads the `profile` query param, loads the profile, and renders GraphiQL with the Explorer plugin and a custom Saved Queries plugin.

### Storage Utilities (`utils/`)

- **`profiles.ts`** — CRUD for profiles stored in `browser.storage.sync` via WXT's `storage` API (`#imports`). Ships with default demo profiles.
- **`queries_storage.ts`** — Per-profile saved queries stored in `browser.storage.sync`. Values are gzip-compressed via `compression.ts`. Provides a `SavedQueriesStorage` interface with getAll/create/save/remove/clear.
- **`settings_storage.ts`** — Namespaced `localStorage` wrapper implementing GraphiQL's `Storage` interface, so each profile's editor state is isolated.
- **`compression.ts`** — Gzip compression/decompression for storage values.

### Key Types

- **`Profile`** (`utils/profiles.ts`) — `{ id: string, name: string, url: string, headers?: Record<string, string> }`
- **`SavedQuery`** (`utils/queries_storage.ts`) — `{ id: string, name: string, query: string, variables?: string, headers?: string, createdAt: number }`
- **`SavedQueriesStorage`** (`utils/queries_storage.ts`) — Interface with `getAll/create/save/remove/clear` methods
- **`FormMode`** (`entrypoints/popup/App.tsx`) — Discriminated union: `{ kind: 'closed' } | { kind: 'create' } | { kind: 'edit', profileId: string }`

### WXT Patterns

- **Auto-imports:** Use `#imports` to import WXT utilities like `storage` and `browser`
- **Typed storage:** `storage.defineItem()` creates typed, reactive storage items with fallback values
- **Reactive updates:** `storage.watch()` enables cross-tab/popup reactive updates (used in GraphiQL to detect profile changes)
- **Browser API:** Import from `wxt/browser` for cross-browser compatibility
- **Testing mock:** `fakeBrowser` from `wxt/testing` mocks browser APIs in unit tests

### State Management

React hooks only — no external state library. `browser.storage.sync` (via WXT) is the source of truth. Components use `storage.watch()` for reactive cross-tab updates. IDs are generated with the `uuid` package.

## Testing

**Unit tests:** Vitest with jsdom environment. Uses `@testing-library/react` and `@testing-library/user-event` for component tests. Browser APIs are mocked with `fakeBrowser` from `wxt/testing`. Coverage thresholds are 95% for lines, functions, branches, and statements.

**E2E tests:** Playwright in `e2e/`. A custom fixture (`e2e/fixtures.ts`) loads the built extension into Chrome.

## Styling

Pure CSS (no preprocessor or CSS-in-JS). Uses GraphiQL's CSS custom properties for theming:

- Spacing: `var(--px-4)`, `var(--px-6)`, `var(--px-8)`, `var(--px-12)`, `var(--px-16)`
- Colors: `var(--color-neutral)`, `var(--color-primary)`, `var(--color-error)`
- Alpha: `var(--alpha-background-light)`, `var(--alpha-background-medium)`, `var(--alpha-background-heavy)`, `var(--alpha-tertiary)`
- Border: `var(--border-radius-4)`
- Font: `var(--font-family)`, `var(--font-size-body)`

Shared reusable components are in `styles/shared.css` with a `.gt-*` class prefix (`.gt-input`, `.gt-btn`, `.gt-list-item`, `.gt-empty`). Component-specific CSS is co-located with its component.

## Requirements

- No code change is considered complete unless tests have been added or updated to address the changes, the full test suite passes, the linter reports no errors, and the code is properly formatted.
- Styling for UI components should mimic that of GraphiQL's UI design whenever possible, using the CSS variables and shared classes described above.
