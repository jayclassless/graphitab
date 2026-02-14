import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { Profile } from '~/utils/profiles'

const mockGetProfile = vi.hoisted(() => vi.fn())
const mockWatchProfiles = vi.hoisted(() => vi.fn(() => vi.fn()))
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
  watch: mockWatchProfiles,
}))

vi.mock('~/utils/queries_storage', () => ({
  createSavedQueriesStorage: mockCreateSavedQueriesStorage,
}))

vi.mock('~/utils/settings_storage', () => ({
  createGraphiQLSettingsStorage: mockCreateSettingsStorage,
}))

const mockGraphiQL = vi.hoisted(() =>
  vi.fn((_props: Record<string, unknown>) => <div data-testid="graphiql">GraphiQL</div>)
)

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
vi.mock('~/styles/shared.css', () => ({}))
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
      expect(mockCreateFetcher).toHaveBeenCalledWith({
        url: 'https://test.com/graphql',
        headers: undefined,
      })
    })
  })

  it('creates fetcher with profile headers when present', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    const profileWithHeaders: Profile = {
      ...mockProfile,
      headers: { Authorization: 'Bearer token123' },
    }
    mockGetProfile.mockResolvedValue(profileWithHeaders)
    render(<App />)
    await waitFor(() => {
      expect(mockCreateFetcher).toHaveBeenCalledWith({
        url: 'https://test.com/graphql',
        headers: { Authorization: 'Bearer token123' },
      })
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

  it('registers a profile watcher on mount', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(mockWatchProfiles).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  it('does not register a watcher when no profile param', async () => {
    mockGetProfile.mockResolvedValue(undefined)
    render(<App />)
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
    expect(mockWatchProfiles).not.toHaveBeenCalled()
  })

  it('unregisters the watcher on unmount', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    const mockUnwatch = vi.fn()
    mockWatchProfiles.mockReturnValue(mockUnwatch)
    const { unmount } = render(<App />)
    await waitFor(() => {
      expect(mockWatchProfiles).toHaveBeenCalled()
    })
    unmount()
    expect(mockUnwatch).toHaveBeenCalled()
  })

  it('updates profile when storage changes', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)

    let watchCallback: (profiles: Profile[]) => void = () => {}
    mockWatchProfiles.mockImplementation(((cb: (profiles: Profile[]) => void) => {
      watchCallback = cb
      return vi.fn()
    }) as typeof mockWatchProfiles)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })

    const updatedProfile: Profile = {
      id: 'test-id',
      name: 'Updated API',
      url: 'https://updated.com/graphql',
    }

    mockCreateFetcher.mockClear()
    act(() => {
      watchCallback([updatedProfile])
    })

    await waitFor(() => {
      expect(document.title).toBe('Updated API - GraphiTab')
    })
    expect(mockCreateFetcher).toHaveBeenCalledWith({
      url: 'https://updated.com/graphql',
      headers: undefined,
    })
  })

  it('skips update when profile data has not changed', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)

    let watchCallback: (profiles: Profile[]) => void = () => {}
    mockWatchProfiles.mockImplementation(((cb: (profiles: Profile[]) => void) => {
      watchCallback = cb
      return vi.fn()
    }) as typeof mockWatchProfiles)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })

    // Fire the watch callback with the same profile data
    mockCreateFetcher.mockClear()
    act(() => {
      watchCallback([{ ...mockProfile }])
    })

    // Title should remain the same, fetcher should not be recreated
    expect(document.title).toBe('Test API - GraphiTab')
    expect(mockCreateFetcher).not.toHaveBeenCalled()
  })

  it('ignores watch callback when current profile is not in the list', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)

    let watchCallback: (profiles: Profile[]) => void = () => {}
    mockWatchProfiles.mockImplementation(((cb: (profiles: Profile[]) => void) => {
      watchCallback = cb
      return vi.fn()
    }) as typeof mockWatchProfiles)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })

    mockCreateFetcher.mockClear()
    act(() => {
      watchCallback([{ id: 'other-id', name: 'Other', url: 'https://other.com/graphql' }])
    })

    expect(document.title).toBe('Test API - GraphiTab')
    expect(mockCreateFetcher).not.toHaveBeenCalled()
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
