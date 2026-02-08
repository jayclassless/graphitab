import { cleanup, render, screen, waitFor } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { Profile } from '~/utils/profiles'

const mockGetProfile = vi.hoisted(() => vi.fn())
const mockCreateFetcher = vi.hoisted(() => vi.fn((opts: unknown) => opts))
const mockCreateSettingsStorage = vi.hoisted(() => vi.fn(() => ({})))
const mockCreateSavedQueriesStorage = vi.hoisted(() =>
  vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  }))
)

vi.mock('~/utils/profiles', () => ({
  get: mockGetProfile,
}))

vi.mock('~/utils/queries_storage', () => ({
  createSavedQueriesStorage: mockCreateSavedQueriesStorage,
}))

vi.mock('~/utils/settings_storage', () => ({
  createGraphiQLSettingsStorage: mockCreateSettingsStorage,
}))

const mockGraphiQL = vi.hoisted(() => vi.fn(() => <div data-testid="graphiql">GraphiQL</div>))

vi.mock('graphiql', () => ({
  GraphiQL: mockGraphiQL,
}))

vi.mock('@graphiql/plugin-explorer', () => ({
  explorerPlugin: vi.fn(() => ({ title: 'Explorer' })),
}))

vi.mock('@graphiql/toolkit', () => ({
  createGraphiQLFetcher: mockCreateFetcher,
}))

vi.mock('../SavedQueriesContent.css', () => ({}))
vi.mock('../App.css', () => ({}))
vi.mock('graphiql/style.css', () => ({}))
vi.mock('@graphiql/plugin-explorer/style.css', () => ({}))

vi.mock('@graphiql/react', () => ({
  useOperationsEditorState: () => '',
  useVariablesEditorState: () => '',
  useHeadersEditorState: () => '',
  useOptimisticState: () => ['', vi.fn()],
}))

import App, { createSavedQueriesPlugin } from '../App'

const mockProfile: Profile = {
  id: 'test-id',
  name: 'Test API',
  url: 'https://test.com/graphql',
}

describe('GraphiQL App', () => {
  afterEach(() => {
    cleanup()
    window.history.pushState({}, '', '/')
    document.title = ''
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockReturnValue(new Promise(() => {}))
    render(<App />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders nothing when no profile query param', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('graphiql')).not.toBeInTheDocument()
  })

  it('shows error message when profile is not found', async () => {
    window.history.pushState({}, '', '?profile=nonexistent')
    mockGetProfile.mockResolvedValue(undefined)
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Profile not found')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('graphiql')).not.toBeInTheDocument()
  })

  it('renders GraphiQL when profile is found', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })
  })

  it('sets document title with profile name', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(document.title).toBe('Test API - GraphiTab')
    })
  })

  it('fetches the correct profile by id from query params', async () => {
    window.history.pushState({}, '', '?profile=my-profile')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledWith('my-profile')
    })
  })

  it('creates fetcher with the profile URL', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(mockCreateFetcher).toHaveBeenCalledWith({ url: 'https://test.com/graphql' })
    })
  })

  it('creates settings storage with the profile id', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(mockCreateSettingsStorage).toHaveBeenCalledWith('test-id')
    })
  })

  it('passes saved queries plugin to GraphiQL', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      const plugins = mockGraphiQL.mock.calls[0][0].plugins
      expect(plugins).toContainEqual(expect.objectContaining({ title: 'Saved Queries' }))
    })
  })
})

describe('createSavedQueriesPlugin', () => {
  afterEach(() => {
    cleanup()
  })

  it('returns a plugin with the correct title', () => {
    const plugin = createSavedQueriesPlugin('test-id')
    expect(plugin.title).toBe('Saved Queries')
  })

  it('renders the icon as an SVG', () => {
    const plugin = createSavedQueriesPlugin('test-id')
    const Icon = plugin.icon
    render(<Icon />)
    expect(document.querySelector('svg')).not.toBeNull()
  })

  it('renders content with the saved queries storage', async () => {
    const plugin = createSavedQueriesPlugin('test-id')
    const Content = plugin.content
    render(<Content />)
    expect(mockCreateSavedQueriesStorage).toHaveBeenCalledWith('test-id')
  })
})
