import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { Profile } from '~/utils/profiles'

const mockGetProfile = vi.hoisted(() => vi.fn())
const mockWatchProfiles = vi.hoisted(() => vi.fn(() => vi.fn()))
const mockBaseFetcher = vi.hoisted(() => vi.fn((..._args: unknown[]) => Promise.resolve({})))
const mockCreateFetcher = vi.hoisted(() => vi.fn(() => mockBaseFetcher))
const mockCreateSettingsStorage = vi.hoisted(() => vi.fn(() => ({})))
const mockCreateSavedQueriesStorage = vi.hoisted(() =>
  vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    watch: vi.fn(() => vi.fn()),
  }))
)

const mockRestore = vi.hoisted(() => vi.fn())

vi.mock('~/utils/profiles', () => ({
  get: mockGetProfile,
  watch: mockWatchProfiles,
  restore: mockRestore,
}))

vi.mock('~/utils/queries_storage', () => ({
  createSavedQueriesStorage: mockCreateSavedQueriesStorage,
}))

vi.mock('~/utils/settings_storage', () => ({
  createGraphiQLSettingsStorage: mockCreateSettingsStorage,
}))

const mockGraphiQL = vi.hoisted(() => {
  const mock = vi.fn((props: Record<string, unknown>) => (
    <div data-testid="graphiql">
      GraphiQL
      {props.children as React.ReactNode}
    </div>
  )) as ReturnType<typeof vi.fn> & {
    Toolbar: React.FC<{
      children?: React.ReactNode | ((args: Record<string, React.ReactNode>) => React.ReactNode)
    }>
  }
  mock.Toolbar = ({ children }: { children?: unknown }) => {
    if (typeof children === 'function') {
      return (
        <div data-testid="toolbar">{children({ prettify: null, copy: null, merge: null })}</div>
      )
    }
    return <div data-testid="toolbar">{children as React.ReactNode}</div>
  }
  return mock
})

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
vi.mock('../ProfileDeletedModal.css', () => ({}))
vi.mock('../ExtensionsModal.css', () => ({}))
vi.mock('../ExtensionsToolbarButton.css', () => ({}))
vi.mock('../App.css', () => ({}))
vi.mock('~/styles/shared.css', () => ({}))
vi.mock('graphiql/style.css', () => ({}))
vi.mock('@graphiql/plugin-explorer/style.css', () => ({}))

vi.mock('@graphiql/react', () => ({
  useOperationsEditorState: () => '',
  useVariablesEditorState: () => '',
  useHeadersEditorState: () => '',
  useOptimisticState: () => ['', vi.fn()],
  useGraphiQLActions: () => ({ addTab: vi.fn() }),
  ToolbarButton: ({ label, children, ...props }: Record<string, unknown>) => (
    <button aria-label={label as string} {...props}>
      {children as React.ReactNode}
    </button>
  ),
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
      expect(mockCreateFetcher).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://test.com/graphql',
          headers: undefined,
          subscriptionUrl: 'wss://test.com/graphql',
          fetch: expect.any(Function),
        })
      )
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
      expect(mockCreateFetcher).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://test.com/graphql',
          headers: { Authorization: 'Bearer token123' },
          subscriptionUrl: 'wss://test.com/graphql',
          fetch: expect.any(Function),
        })
      )
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
    expect(mockCreateFetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://updated.com/graphql',
        headers: undefined,
        subscriptionUrl: 'wss://updated.com/graphql',
        fetch: expect.any(Function),
      })
    )
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

  it('skips update when headers have same entries in different order', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    const profileWithHeaders: Profile = {
      ...mockProfile,
      headers: { Authorization: 'Bearer token', 'X-Custom': 'value' },
    }
    mockGetProfile.mockResolvedValue(profileWithHeaders)

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
      watchCallback([
        {
          ...mockProfile,
          headers: { 'X-Custom': 'value', Authorization: 'Bearer token' },
        },
      ])
    })

    expect(mockCreateFetcher).not.toHaveBeenCalled()
  })

  it('shows deleted modal when profile is removed from storage', async () => {
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

    act(() => {
      watchCallback([{ id: 'other-id', name: 'Other', url: 'https://other.com/graphql' }])
    })

    await waitFor(() => {
      expect(screen.getByText(/Test API/)).toBeInTheDocument()
      expect(screen.getByText(/has been deleted/)).toBeInTheDocument()
    })
    expect(screen.getByText('Restore')).toBeInTheDocument()
    expect(screen.getByText('Close Tab')).toBeInTheDocument()
  })

  it('renders Extensions toolbar button', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Extensions')).toBeInTheDocument()
  })

  it('opens and closes the extensions modal', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })

    // Open modal
    await act(async () => {
      screen.getByLabelText('Extensions').click()
    })
    expect(screen.getByText('Extensions', { selector: 'h3' })).toBeInTheDocument()

    // Close modal via Cancel
    await act(async () => {
      screen.getByText('Cancel').click()
    })
    expect(screen.queryByText('Extensions', { selector: 'h3' })).not.toBeInTheDocument()
  })

  it('shows indicator after saving extensions and passes them to fetcher', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })

    // No indicator initially
    expect(document.querySelector('.extensions-toolbar-indicator')).not.toBeInTheDocument()

    // Open modal, type extensions, save
    await act(async () => {
      screen.getByLabelText('Extensions').click()
    })
    const textarea = screen.getByRole('textbox')
    await act(async () => {
      textarea.focus()
      // Use fireEvent since we need to set the value directly
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )!.set!
      nativeInputValueSetter.call(textarea, '{"key": "val"}')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => {
      screen.getByText('Save').click()
    })

    // Indicator should now appear
    expect(document.querySelector('.extensions-toolbar-indicator')).toBeInTheDocument()

    // Verify the fetcher wrapper includes extensions when calling baseFetcher
    const fetcherProp = mockGraphiQL.mock.calls.at(-1)?.[0]?.fetcher as (
      params: Record<string, unknown>
    ) => unknown
    mockBaseFetcher.mockClear()
    await fetcherProp({ query: '{ test }' })
    expect(mockBaseFetcher).toHaveBeenCalledWith(
      expect.objectContaining({ query: '{ test }', extensions: { key: 'val' } }),
      undefined
    )
  })

  it('switches extensions per tab via onTabChange', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })

    // Get the onTabChange callback
    const onTabChange = mockGraphiQL.mock.calls.at(-1)?.[0]?.onTabChange as (tabsState: {
      tabs: { id: string }[]
      activeTabIndex: number
    }) => void
    expect(onTabChange).toBeTruthy()

    // Simulate first tab initialization
    act(() => {
      onTabChange({ tabs: [{ id: 'tab-1' }], activeTabIndex: 0 })
    })

    // Set extensions on tab-1
    await act(async () => {
      screen.getByLabelText('Extensions').click()
    })
    const textarea = screen.getByRole('textbox')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )!.set!
      setter.call(textarea, '{"tab1": true}')
      textarea.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => {
      screen.getByText('Save').click()
    })
    expect(document.querySelector('.extensions-toolbar-indicator')).toBeInTheDocument()

    // Switch to tab-2 (no extensions)
    act(() => {
      onTabChange({ tabs: [{ id: 'tab-1' }, { id: 'tab-2' }], activeTabIndex: 1 })
    })
    expect(document.querySelector('.extensions-toolbar-indicator')).not.toBeInTheDocument()

    // Switch back to tab-1 (extensions restored)
    act(() => {
      onTabChange({ tabs: [{ id: 'tab-1' }, { id: 'tab-2' }], activeTabIndex: 0 })
    })
    expect(document.querySelector('.extensions-toolbar-indicator')).toBeInTheDocument()
  })

  it('clears deleted state after restore', async () => {
    window.history.pushState({}, '', '?profile=test-id')
    mockGetProfile.mockResolvedValue(mockProfile)
    mockRestore.mockResolvedValue(undefined)

    let watchCallback: (profiles: Profile[]) => void = () => {}
    mockWatchProfiles.mockImplementation(((cb: (profiles: Profile[]) => void) => {
      watchCallback = cb
      return vi.fn()
    }) as typeof mockWatchProfiles)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('graphiql')).toBeInTheDocument()
    })

    act(() => {
      watchCallback([])
    })

    await waitFor(() => {
      expect(screen.getByText('Restore')).toBeInTheDocument()
    })

    await act(async () => {
      screen.getByText('Restore').click()
    })

    await waitFor(() => {
      expect(screen.queryByText('has been deleted.')).not.toBeInTheDocument()
    })
    expect(mockRestore).toHaveBeenCalled()
  })
})

describe('createSavedQueriesPlugin', () => {
  afterEach(() => {
    cleanup()
  })

  it('returns a plugin with the correct title', () => {
    const plugin = createSavedQueriesPlugin('test-id', { current: '' }, vi.fn())
    expect(plugin.title).toBe('Saved Queries')
  })

  it('renders the icon as an SVG', () => {
    const plugin = createSavedQueriesPlugin('test-id', { current: '' }, vi.fn())
    const Icon = plugin.icon
    render(<Icon />)
    expect(document.querySelector('svg')).not.toBeNull()
  })

  it('renders content with the saved queries storage', async () => {
    const plugin = createSavedQueriesPlugin('test-id', { current: '' }, vi.fn())
    const Content = plugin.content
    render(<Content />)
    expect(mockCreateSavedQueriesStorage).toHaveBeenCalledWith('test-id')
  })
})
