import { browser } from 'wxt/browser'

import type { GraphQLRequest } from '~/entrypoints/devtools-panel/har'

import type { Profile } from './profiles'

export type GraphiQLInitialState = {
  query: string
  variables?: string
  extensions?: string
  headers?: string
}

export function canOpenInGraphiQL(request: GraphQLRequest): boolean {
  if (request.operationType === 'batch') return false
  if (request.persisted && !request.query) return false
  return true
}

const GRAPHQL_PARAMS = ['query', 'operationName', 'variables', 'extensions']

export function stripGraphQLParams(url: string): string {
  try {
    const parsed = new URL(url)
    for (const param of GRAPHQL_PARAMS) {
      parsed.searchParams.delete(param)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function findProfileByUrl(profiles: Profile[], url: string): Profile | undefined {
  const normalizedUrl = normalizeEndpointUrl(url)
  return profiles.find((p) => normalizeEndpointUrl(p.url) === normalizedUrl)
}

function normalizeEndpointUrl(url: string): string {
  try {
    const parsed = new URL(stripGraphQLParams(url))
    parsed.searchParams.sort()
    return (parsed.origin + parsed.pathname).replace(/\/+$/, '') + parsed.search
  } catch {
    return url.replace(/\/+$/, '')
  }
}

export function buildInitialState(request: GraphQLRequest): GraphiQLInitialState {
  const state: GraphiQLInitialState = { query: request.query }

  if (request.variables) {
    state.variables = request.variables
  }

  if (request.extensions) {
    state.extensions = request.extensions
  }

  const authHeader = request.headers.find((h) => h.name.toLowerCase() === 'authorization')
  if (authHeader) {
    state.headers = JSON.stringify({ Authorization: authHeader.value }, null, 2)
  }

  return state
}

const SESSION_KEY_PREFIX = 'graphiql:initialState:'

export async function storeInitialState(
  profileId: string,
  state: GraphiQLInitialState
): Promise<void> {
  await browser.storage.session.set({ [SESSION_KEY_PREFIX + profileId]: state })
}

export async function consumeInitialState(profileId: string): Promise<GraphiQLInitialState | null> {
  const key = SESSION_KEY_PREFIX + profileId
  const result = await browser.storage.session.get(key)
  const state = result[key] as GraphiQLInitialState | undefined
  if (state) {
    await browser.storage.session.remove(key)
    return state
  }
  return null
}

export async function openGraphiQLTab(profileId: string): Promise<void> {
  await browser.tabs.create({
    url: browser.runtime.getURL(`/graphiql.html?profile=${profileId}`),
  })
}
