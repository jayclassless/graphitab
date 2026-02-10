# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

GraphiTab is a browser extension (Chrome/Firefox) that provides GraphiQL (a GraphQL IDE) in a new tab. Built with WXT (Web Extension Tools) and React.

## Commands

- `pnpm dev` — start dev mode (Chrome)
- `pnpm dev:firefox` — start dev mode (Firefox)
- `pnpm build` — production build (Chrome)
- `pnpm build:firefox` — production build (Firefox)
- `pnpm test` — run all tests
- `pnpm test -- utils/__tests__/profiles.test.ts` — run a single test file
- `pnpm compile` — TypeScript type checking (`tsc --noEmit`)
- `pnpm lint` — lint with oxlint
- `pnpm format` — format with oxfmt

## Architecture

The extension has two entrypoints, each a standalone React app:

- **`entrypoints/popup/`** — The browser action popup. Manages profiles (name + GraphQL endpoint URL). Each profile links to the GraphiQL page via query param (`/graphiql.html?profile=<id>`).
- **`entrypoints/graphiql/`** — The main GraphiQL page, opened in a new tab. Reads the `profile` query param, loads the profile, and renders GraphiQL with the Explorer plugin and a custom Saved Queries plugin.

### Storage Utilities (`utils/`)

- **`profiles.ts`** — CRUD for profiles (id, name, url) stored in `browser.storage.sync` via WXT's `storage` API (`#imports`). Ships with default demo profiles.
- **`queries_storage.ts`** — Per-profile saved queries stored in `browser.storage.sync`. Provides a `SavedQueriesStorage` interface with getAll/create/save/remove/clear.
- **`settings_storage.ts`** — Namespaced `localStorage` wrapper implementing GraphiQL's `Storage` interface, so each profile's editor state is isolated.

## Requirements

- No code change is considered complete unless tests have been added or updated to address the changes, the full test suite passes, the linter reports no errors, and the code is property formatted.
- Styling for UI components should mimic that of GraphiQL's UI design whenever possible.
