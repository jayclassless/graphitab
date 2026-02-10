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
const mockCreate = vi.fn<(name: string, url: string) => Promise<Profile>>()

vi.mock('~/utils/profiles', () => ({
  getAll: () => mockGetAll(),
  remove: (id: string) => mockRemove(id),
  create: (name: string, url: string) => mockCreate(name, url),
}))

const mockTabsQuery = vi.fn<(queryInfo: object) => Promise<{ id: number }[]>>()
const mockTabsRemove = vi.fn<(tabIds: number[]) => Promise<void>>()

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: (path: string) => `chrome-extension://test-id${path}`,
    },
    tabs: {
      query: (queryInfo: object) => mockTabsQuery(queryInfo),
      remove: (tabIds: number[]) => mockTabsRemove(tabIds),
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
    mockGetAll.mockResolvedValue([...mockProfiles])
    mockRemove.mockResolvedValue(undefined)
    mockCreate.mockResolvedValue({ id: 'new', name: 'New', url: 'https://new.com/graphql' })
    mockTabsQuery.mockResolvedValue([])
    mockTabsRemove.mockResolvedValue(undefined)
  })

  async function renderApp() {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled()
    })
    return { user }
  }

  describe('profile list', () => {
    it('renders profiles sorted alphabetically', async () => {
      await renderApp()
      const links = screen.getAllByRole('link')
      expect(links[0]).toHaveTextContent('Alpha API')
      expect(links[1]).toHaveTextContent('Bravo API')
    })

    it('renders profile links with correct hrefs', async () => {
      await renderApp()
      const link = screen.getByText('Alpha API')
      expect(link).toHaveAttribute('href', '/graphiql.html?profile=a')
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
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql')
      expect(mockGetAll).toHaveBeenCalledTimes(2)
    })

    it('submits on Enter in URL field', async () => {
      const { user } = await renderApp()
      await user.click(screen.getByText('+ New Profile'))
      await user.type(screen.getByPlaceholderText('Name'), 'Test')
      await user.type(
        screen.getByPlaceholderText('GraphQL endpoint URL'),
        'https://example.com/graphql{Enter}'
      )
      expect(mockCreate).toHaveBeenCalledWith('Test', 'https://example.com/graphql')
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

    it('closes open tabs for the deleted profile', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 10 }, { id: 20 }])
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Confirm'))
      expect(mockTabsQuery).toHaveBeenCalledWith({
        url: 'chrome-extension://test-id/graphiql.html?profile=a',
      })
      expect(mockTabsRemove).toHaveBeenCalledWith([10, 20])
    })

    it('does not call tabs.remove when no tabs are open', async () => {
      mockTabsQuery.mockResolvedValue([])
      const { user } = await renderApp()
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Confirm'))
      expect(mockTabsQuery).toHaveBeenCalled()
      expect(mockTabsRemove).not.toHaveBeenCalled()
    })
  })
})
