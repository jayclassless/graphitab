import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { Profile } from '~/utils/profiles'

const mockProfiles: Profile[] = [
  { id: 'b', name: 'Bravo API', url: 'https://bravo.com/graphql' },
  { id: 'a', name: 'Alpha API', url: 'https://alpha.com/graphql' },
]

const mockGetAll = vi.fn<() => Promise<Profile[]>>()
const mockRemove = vi.fn<(id: string) => Promise<void>>()
const mockCreate =
  vi.fn<(name: string, url: string, headers?: Record<string, string>) => Promise<Profile>>()
const mockUpdate =
  vi.fn<
    (id: string, name: string, url: string, headers?: Record<string, string>) => Promise<Profile>
  >()

vi.mock('~/utils/profiles', () => ({
  getAll: () => mockGetAll(),
  remove: (id: string) => mockRemove(id),
  create: (name: string, url: string, headers?: Record<string, string>) =>
    mockCreate(name, url, headers),
  update: (id: string, name: string, url: string, headers?: Record<string, string>) =>
    mockUpdate(id, name, url, headers),
}))

const mockTabsCreate = vi.fn<(options: { url: string; windowId?: number }) => Promise<unknown>>()
const mockWindowsGetCurrent = vi.fn<() => Promise<{ id: number }>>()

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      create: (options: { url: string; windowId?: number }) => mockTabsCreate(options),
    },
    windows: { getCurrent: () => mockWindowsGetCurrent() },
    runtime: {
      getURL: (path: string) => `chrome-extension://test-id${path}`,
      getManifest: () => ({ homepage_url: 'https://github.com/jayclassless/graphitab' }),
    },
  },
}))

// Stub CSS imports
vi.mock('../App.css', () => ({}))
vi.mock('~/styles/shared.css', () => ({}))
vi.mock('graphiql/style.css', () => ({}))
vi.mock('~/components/ConfirmDeleteButton.css', () => ({}))

import App from '../App'

describe('Popup App', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'close').mockImplementation(() => {})
    mockGetAll.mockResolvedValue([...mockProfiles])
    mockRemove.mockResolvedValue(undefined)
    mockCreate.mockResolvedValue({ id: 'new', name: 'New', url: 'https://new.com/graphql' })
    mockUpdate.mockResolvedValue({ id: 'a', name: 'Updated', url: 'https://updated.com/graphql' })
    mockTabsCreate.mockResolvedValue({})
    mockWindowsGetCurrent.mockResolvedValue({ id: 42 })
  })

  async function renderApp() {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled()
    })
    return { user }
  }

  describe('header', () => {
    it('renders icon linking to project home page', async () => {
      await renderApp()
      const iconLink = screen.getByTitle('GraphiTab Homepage')
      expect(iconLink).toHaveAttribute('href', 'https://github.com/jayclassless/graphitab')
      expect(iconLink).toHaveAttribute('target', '_blank')
      expect(iconLink.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('profile list', () => {
    it('renders profiles sorted alphabetically', async () => {
      await renderApp()
      const profileLinks = screen.getAllByRole('link').filter((el) => el.classList.contains('gt-list-item'))
      expect(profileLinks[0]).toHaveTextContent('Alpha API')
      expect(profileLinks[1]).toHaveTextContent('Bravo API')
    })

    it('renders profile links with correct hrefs', async () => {
      await renderApp()
      const link = screen.getByText('Alpha API')
      expect(link).toHaveAttribute('href', '/graphiql.html?profile=a')
    })

    it('opens profile in the current window via browser.tabs.create', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('Alpha API'))
      expect(mockWindowsGetCurrent).toHaveBeenCalled()
      await waitFor(() => {
        expect(mockTabsCreate).toHaveBeenCalledWith({
          url: 'chrome-extension://test-id/graphiql.html?profile=a',
          windowId: 42,
        })
      })
      expect(window.close).toHaveBeenCalled()
    })

    it('shows empty message when no profiles exist', async () => {
      mockGetAll.mockResolvedValue([])
      await renderApp()
      expect(screen.getByText('No profiles configured')).toBeInTheDocument()
    })
  })

  describe('create profile', () => {
    it('shows form when "+ New Profile" is clicked', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('GraphQL endpoint URL')).toBeInTheDocument()
    })

    it('hides form and resets inputs on Cancel', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
      expect(screen.getByText('+ New Profile')).toBeInTheDocument()
    })

    it('disables Add button when fields are empty', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      expect(screen.getByText('Add')).toBeDisabled()
    })

    it('disables Add button when URL is invalid', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(screen.getByPlaceholderText('GraphQL endpoint URL'), 'not-a-url')
      expect(screen.getByText('Add')).toBeDisabled()
    })

    it('marks URL input as invalid for bad URLs', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('GraphQL endpoint URL'), 'not-a-url')
      expect(screen.getByPlaceholderText('GraphQL endpoint URL')).toHaveClass('popup-input-invalid')
    })

    it('enables Add button when name and valid URL are provided', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      expect(screen.getByText('Add')).toBeEnabled()
    })

    it('calls create and reloads profiles on submit', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('Add'))
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql', undefined)
      expect(mockGetAll).toHaveBeenCalledTimes(2)
    })

    it('submits on Enter in Name field', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.type(screen.getByPlaceholderText('Name'), 'Test{Enter}')
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql', undefined)
    })

    it('submits on Enter in URL field', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql{Enter}'
      )
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql', undefined)
    })

    it('disables Add button when name duplicates an existing profile', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Alpha API')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      expect(screen.getByText('Add')).toBeDisabled()
      expect(screen.getByText('A profile with this name already exists')).toBeInTheDocument()
    })

    it('duplicate name check is case-insensitive', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'alpha api')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      expect(screen.getByText('Add')).toBeDisabled()
      expect(screen.getByText('A profile with this name already exists')).toBeInTheDocument()
    })

    it('does not create on Enter when form is invalid', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('GraphQL endpoint URL'), 'not-a-url{Enter}')
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('hides the form after successful create', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('Add'))
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
      })
    })
  })

  describe('edit profile', () => {
    it('shows edit buttons for each profile', async () => {
      await renderApp()
      const editButtons = screen.getAllByTitle('Edit')
      expect(editButtons).toHaveLength(2)
    })

    it('pre-fills form with profile data when Edit is clicked', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      expect(screen.getByPlaceholderText('Name')).toHaveValue('Alpha API')
      expect(screen.getByPlaceholderText('GraphQL endpoint URL')).toHaveValue(
        'https://alpha.com/graphql'
      )
    })

    it('shows "Save" button instead of "Add" in edit mode', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      expect(screen.getByText('Save')).toBeInTheDocument()
      expect(screen.queryByText('Add')).not.toBeInTheDocument()
    })

    it('calls update with correct args on Save', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.clear(screen.getByPlaceholderText('Name'))
      await user.type(screen.getByPlaceholderText('Name'), 'Updated Alpha')
      await user.clear(screen.getByPlaceholderText('GraphQL endpoint URL'))
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://updated.com/graphql'
      )
      await user.click(screen.getByText('Save'))
      expect(mockUpdate).toHaveBeenCalledWith(
        'a',
        'Updated Alpha',
        'https://updated.com/graphql',
        undefined
      )
      expect(mockGetAll).toHaveBeenCalledTimes(2)
    })

    it('hides form after successful update', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.click(screen.getByText('Save'))
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
      })
    })

    it('discards changes on Cancel', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.clear(screen.getByPlaceholderText('Name'))
      await user.type(screen.getByPlaceholderText('Name'), 'Changed')
      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
      expect(screen.getByText('+ New Profile')).toBeInTheDocument()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('validates URL in edit mode', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.clear(screen.getByPlaceholderText('GraphQL endpoint URL'))
      await user.type(screen.getByPlaceholderText('GraphQL endpoint URL'), 'not-a-url')
      expect(screen.getByText('Save')).toBeDisabled()
      expect(screen.getByPlaceholderText('GraphQL endpoint URL')).toHaveClass('popup-input-invalid')
    })

    it('allows saving with the same name when editing', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      // Name is pre-filled as "Alpha API" — should still be submittable
      expect(screen.getByText('Save')).toBeEnabled()
      expect(screen.queryByText('A profile with this name already exists')).not.toBeInTheDocument()
    })

    it('disables Save when name matches a different profile', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.clear(screen.getByPlaceholderText('Name'))
      await user.type(screen.getByPlaceholderText('Name'), 'Bravo API')
      expect(screen.getByText('Save')).toBeDisabled()
      expect(screen.getByText('A profile with this name already exists')).toBeInTheDocument()
    })

    it('disables Save when name is empty', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.clear(screen.getByPlaceholderText('Name'))
      expect(screen.getByText('Save')).toBeDisabled()
    })

    it('does not update when name is empty and Enter is pressed', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.clear(screen.getByPlaceholderText('Name'))
      await user.type(screen.getByPlaceholderText('Name'), '{Enter}')
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('submits on Enter in URL field during edit', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.clear(screen.getByPlaceholderText('Name'))
      await user.type(screen.getByPlaceholderText('Name'), 'Updated')
      await user.clear(screen.getByPlaceholderText('GraphQL endpoint URL'))
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://updated.com/graphql{Enter}'
      )
      expect(mockUpdate).toHaveBeenCalledWith(
        'a',
        'Updated',
        'https://updated.com/graphql',
        undefined
      )
    })

    it('switches from create to edit mode', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      expect(screen.getByText('Add')).toBeInTheDocument()
      await user.click(screen.getAllByTitle('Edit')[0])
      expect(screen.getByText('Save')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Name')).toHaveValue('Alpha API')
    })

    it('switches between editing different profiles', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      expect(screen.getByPlaceholderText('Name')).toHaveValue('Alpha API')
      await user.click(screen.getAllByTitle('Edit')[1])
      expect(screen.getByPlaceholderText('Name')).toHaveValue('Bravo API')
    })

    it('shows error when update fails', async () => {
      mockUpdate.mockRejectedValue(new Error('storage error'))
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Edit')[0])
      await user.click(screen.getByText('Save'))
      await waitFor(() => {
        expect(screen.getByText('Failed to update profile')).toBeInTheDocument()
      })
    })
  })

  describe('headers', () => {
    it('shows "+ Add Header" button when form is open', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      expect(screen.getByText('+ Add Header')).toBeInTheDocument()
    })

    it('adds a header row when "+ Add Header" is clicked', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.click(screen.getByText('+ Add Header'))
      expect(screen.getByPlaceholderText('Header name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Value')).toBeInTheDocument()
    })

    it('removes a header row when remove button is clicked', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.click(screen.getByText('+ Add Header'))
      expect(screen.getByPlaceholderText('Header name')).toBeInTheDocument()
      await user.click(screen.getByTitle('Remove header'))
      expect(screen.queryByPlaceholderText('Header name')).not.toBeInTheDocument()
    })

    it('pre-fills headers when editing a profile with headers', async () => {
      mockGetAll.mockResolvedValue([
        {
          id: 'h',
          name: 'Header API',
          url: 'https://header.com/graphql',
          headers: { Authorization: 'Bearer xyz' },
        },
      ])
      const { user } = await renderApp()
      await user.click(screen.getByTitle('Edit'))
      expect(screen.getByPlaceholderText('Header name')).toHaveValue('Authorization')
      expect(screen.getByPlaceholderText('Value')).toHaveValue('Bearer xyz')
    })

    it('passes headers to create', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('+ Add Header'))
      await user.type(screen.getByPlaceholderText('Header name'), 'Authorization')
      await user.type(screen.getByPlaceholderText('Value'), 'Bearer token')
      await user.click(screen.getByText('Add'))
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql', {
        Authorization: 'Bearer token',
      })
    })

    it('passes headers to update', async () => {
      mockGetAll.mockResolvedValue([
        { id: 'a', name: 'Alpha API', url: 'https://alpha.com/graphql' },
      ])
      const { user } = await renderApp()
      await user.click(screen.getByTitle('Edit'))
      await user.click(screen.getByText('+ Add Header'))
      await user.type(screen.getByPlaceholderText('Header name'), 'X-Key')
      await user.type(screen.getByPlaceholderText('Value'), 'val')
      await user.click(screen.getByText('Save'))
      expect(mockUpdate).toHaveBeenCalledWith('a', 'Alpha API', 'https://alpha.com/graphql', {
        'X-Key': 'val',
      })
    })

    it('trims header values', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('+ Add Header'))
      await user.type(screen.getByPlaceholderText('Header name'), '  Authorization  ')
      await user.type(screen.getByPlaceholderText('Value'), '  Bearer token  ')
      await user.click(screen.getByText('Add'))
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql', {
        Authorization: 'Bearer token',
      })
    })

    it('filters out headers with empty keys', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('+ Add Header'))
      // Leave key empty, only type value
      await user.type(screen.getByPlaceholderText('Value'), 'some-value')
      await user.click(screen.getByText('Add'))
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql', undefined)
    })
  })

  describe('delete profile', () => {
    it('shows confirm/cancel on first delete click', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Delete')[0])
      expect(screen.getByText('Confirm')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it('cancels delete confirmation', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it('deletes profile on confirm', async () => {
      const { user } = await renderApp()
      // First click on Alpha's delete button (sorted first)
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Confirm'))
      expect(mockRemove).toHaveBeenCalledWith('a')
      expect(mockGetAll).toHaveBeenCalledTimes(2)
    })

    it('reloads profiles after deletion', async () => {
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Confirm'))
      expect(mockRemove).toHaveBeenCalledWith('a')
      expect(mockGetAll).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('shows error when loading profiles fails', async () => {
      mockGetAll.mockRejectedValue(new Error('storage error'))
      render(<App />)
      await waitFor(() => {
        expect(screen.getByText('Failed to load profiles')).toBeInTheDocument()
      })
    })

    it('shows error when creating a profile fails', async () => {
      const { user } = await renderApp()
      mockCreate.mockRejectedValue(new Error('storage error'))
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('Add'))
      await waitFor(() => {
        expect(screen.getByText('Failed to create profile')).toBeInTheDocument()
      })
    })

    it('shows error when deleting a profile fails', async () => {
      mockRemove.mockRejectedValue(new Error('storage error'))
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Confirm'))
      await waitFor(() => {
        expect(screen.getByText('Failed to delete profile')).toBeInTheDocument()
      })
    })

    it('clears error on next successful action', async () => {
      const { user } = await renderApp()
      mockCreate.mockRejectedValueOnce(new Error('storage error'))
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('Add'))
      await waitFor(() => {
        expect(screen.getByText('Failed to create profile')).toBeInTheDocument()
      })
      // Retry — create succeeds this time, error clears at start of action
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql'
      )
      await user.click(screen.getByText('Add'))
      await waitFor(() => {
        expect(screen.queryByText('Failed to create profile')).not.toBeInTheDocument()
      })
    })
  })
})
