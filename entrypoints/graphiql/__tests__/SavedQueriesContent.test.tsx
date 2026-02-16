import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { SavedQueriesStorage } from '~/utils/queries_storage'

const mocks = vi.hoisted(() => ({
  handleEditOperations: vi.fn(),
  handleEditVariables: vi.fn(),
  handleEditHeaders: vi.fn(),
  operations: '{ hero { name } }',
  variables: '{"id": 1}',
  headers: '{"Auth": "Bearer"}',
}))

vi.mock('@graphiql/react', () => {
  const opState = Symbol('op')
  const varState = Symbol('var')
  const headerState = Symbol('header')
  return {
    useOperationsEditorState: () => opState,
    useVariablesEditorState: () => varState,
    useHeadersEditorState: () => headerState,
    useOptimisticState: (state: unknown): [string, (val: string) => void] => {
      if (state === opState) return [mocks.operations, mocks.handleEditOperations]
      if (state === varState) return [mocks.variables, mocks.handleEditVariables]
      if (state === headerState) return [mocks.headers, mocks.handleEditHeaders]
      return ['', vi.fn()]
    },
  }
})

vi.mock('../SavedQueriesContent.css', () => ({}))
vi.mock('~/styles/shared.css', () => ({}))
vi.mock('~/components/ConfirmDeleteButton.css', () => ({}))

import SavedQueriesContent from '../SavedQueriesContent'

const savedQueries = [
  {
    id: '1',
    name: 'Bravo Query',
    query: '{ b }',
    variables: '{"x":1}',
    headers: '{"H":"v"}',
    createdAt: 2000,
  },
  { id: '2', name: 'Alpha Query', query: '{ a }', createdAt: 1000 },
]

function createMockStorage(queries = savedQueries): SavedQueriesStorage {
  const store = [...queries]
  return {
    getAll: vi.fn().mockResolvedValue(store),
    create: vi.fn().mockResolvedValue(store),
    save: vi.fn().mockResolvedValue(store),
    remove: vi.fn().mockResolvedValue(store),
    clear: vi.fn(),
    watch: vi.fn(() => vi.fn()),
  }
}

describe('SavedQueriesContent', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.operations = '{ hero { name } }'
    mocks.variables = '{"id": 1}'
    mocks.headers = '{"Auth": "Bearer"}'
  })

  async function renderContent(storage?: SavedQueriesStorage) {
    const s = storage ?? createMockStorage()
    const user = userEvent.setup()
    render(<SavedQueriesContent storage={s} />)
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
    return { user, storage: s }
  }

  describe('query list', () => {
    it('shows empty message when no queries exist', async () => {
      await renderContent(createMockStorage([]))
      expect(screen.getByText('No saved queries yet')).toBeInTheDocument()
    })

    it('renders saved query names', async () => {
      await renderContent()
      expect(screen.getByText('Alpha Query')).toBeInTheDocument()
      expect(screen.getByText('Bravo Query')).toBeInTheDocument()
    })

    it('sorts queries by name ascending by default', async () => {
      await renderContent()
      const buttons = screen.getAllByRole('button', { name: /Query/ })
      expect(buttons[0]).toHaveTextContent('Alpha Query')
      expect(buttons[1]).toHaveTextContent('Bravo Query')
    })

    it('hides sort controls when no queries exist', async () => {
      await renderContent(createMockStorage([]))
      expect(screen.queryByText('Sort by Name')).not.toBeInTheDocument()
    })
  })

  describe('save', () => {
    it('disables Save button when name is empty', async () => {
      await renderContent()
      expect(screen.getByText('Save')).toBeDisabled()
    })

    it('disables Save button when operations string is empty', async () => {
      mocks.operations = ''
      const { user } = await renderContent()
      await user.type(screen.getByPlaceholderText('Query name...'), 'Test')
      expect(screen.getByText('Save')).toBeDisabled()
    })

    it('calls storage.create with correct arguments', async () => {
      const { user, storage } = await renderContent()
      await user.type(screen.getByPlaceholderText('Query name...'), 'My Query')
      await user.click(screen.getByText('Save'))
      expect(storage.create).toHaveBeenCalledWith(
        'My Query',
        '{ hero { name } }',
        '{"id": 1}',
        '{"Auth": "Bearer"}'
      )
    })

    it('clears name input after save', async () => {
      const { user } = await renderContent()
      const input = screen.getByPlaceholderText('Query name...')
      await user.type(input, 'My Query')
      await user.click(screen.getByText('Save'))
      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })

    it('reloads queries after save', async () => {
      const { user, storage } = await renderContent()
      await user.type(screen.getByPlaceholderText('Query name...'), 'My Query')
      await user.click(screen.getByText('Save'))
      await waitFor(() => {
        expect(storage.getAll).toHaveBeenCalledTimes(2)
      })
    })

    it('saves on Enter key in name input', async () => {
      const { user, storage } = await renderContent()
      await user.type(screen.getByPlaceholderText('Query name...'), 'My Query{Enter}')
      expect(storage.create).toHaveBeenCalledWith(
        'My Query',
        '{ hero { name } }',
        '{"id": 1}',
        '{"Auth": "Bearer"}'
      )
    })

    it('does not save on Enter when name is empty', async () => {
      const { user, storage } = await renderContent()
      await user.type(screen.getByPlaceholderText('Query name...'), '{Enter}')
      expect(storage.create).not.toHaveBeenCalled()
    })

    it('does not save on Enter when operations string is empty', async () => {
      mocks.operations = ''
      const { user, storage } = await renderContent()
      await user.type(screen.getByPlaceholderText('Query name...'), 'My Query{Enter}')
      expect(storage.create).not.toHaveBeenCalled()
    })
  })

  describe('load', () => {
    it('loads query into editors on click', async () => {
      const { user } = await renderContent()
      await user.click(screen.getByText('Bravo Query'))
      expect(mocks.handleEditOperations).toHaveBeenCalledWith('{ b }')
      expect(mocks.handleEditVariables).toHaveBeenCalledWith('{"x":1}')
      expect(mocks.handleEditHeaders).toHaveBeenCalledWith('{"H":"v"}')
    })

    it('loads empty string for undefined variables and headers', async () => {
      const { user } = await renderContent()
      await user.click(screen.getByText('Alpha Query'))
      expect(mocks.handleEditOperations).toHaveBeenCalledWith('{ a }')
      expect(mocks.handleEditVariables).toHaveBeenCalledWith('')
      expect(mocks.handleEditHeaders).toHaveBeenCalledWith('')
    })
  })

  describe('delete', () => {
    it('shows confirm/cancel on first delete click', async () => {
      const { user, storage } = await renderContent()
      await user.click(screen.getAllByTitle('Delete')[0])
      expect(screen.getByText('Confirm')).toBeInTheDocument()
      expect(storage.remove).not.toHaveBeenCalled()
    })

    it('cancels delete confirmation', async () => {
      const { user } = await renderContent()
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
    })

    it('deletes query on confirm', async () => {
      const { user, storage } = await renderContent()
      // Alpha is sorted first
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Confirm'))
      expect(storage.remove).toHaveBeenCalledWith('2')
    })
  })

  describe('sorting', () => {
    it('sorts by date when selected', async () => {
      const { user } = await renderContent()
      await user.selectOptions(screen.getByRole('combobox'), 'createdAt')
      const buttons = screen.getAllByRole('button', { name: /Query/ })
      // createdAt asc: Alpha (1000), Bravo (2000)
      expect(buttons[0]).toHaveTextContent('Alpha Query')
      expect(buttons[1]).toHaveTextContent('Bravo Query')
    })

    it('toggles sort direction', async () => {
      const { user } = await renderContent()
      // Default: name asc → Alpha, Bravo
      const toggle = screen.getByTitle('Ascending')
      await user.click(toggle)
      // Now name desc → Bravo, Alpha
      const buttons = screen.getAllByRole('button', { name: /Query/ })
      expect(buttons[0]).toHaveTextContent('Bravo Query')
      expect(buttons[1]).toHaveTextContent('Alpha Query')
      expect(screen.getByTitle('Descending')).toBeInTheDocument()
    })

    it('toggles sort direction back to ascending', async () => {
      const { user } = await renderContent()
      // asc → desc
      await user.click(screen.getByTitle('Ascending'))
      expect(screen.getByTitle('Descending')).toBeInTheDocument()
      // desc → asc
      await user.click(screen.getByTitle('Descending'))
      expect(screen.getByTitle('Ascending')).toBeInTheDocument()
      const buttons = screen.getAllByRole('button', { name: /Query/ })
      expect(buttons[0]).toHaveTextContent('Alpha Query')
      expect(buttons[1]).toHaveTextContent('Bravo Query')
    })

    it('sorts by date descending', async () => {
      const { user } = await renderContent()
      await user.selectOptions(screen.getByRole('combobox'), 'createdAt')
      await user.click(screen.getByTitle('Ascending'))
      // createdAt desc: Bravo (2000), Alpha (1000)
      const buttons = screen.getAllByRole('button', { name: /Query/ })
      expect(buttons[0]).toHaveTextContent('Bravo Query')
      expect(buttons[1]).toHaveTextContent('Alpha Query')
    })
  })

  describe('error handling', () => {
    it('shows error when loading queries fails', async () => {
      const storage = createMockStorage()
      storage.getAll = vi.fn().mockRejectedValue(new Error('storage error'))
      render(<SavedQueriesContent storage={storage} />)
      await waitFor(() => {
        expect(screen.getByText('Failed to load saved queries')).toBeInTheDocument()
      })
    })

    it('shows error when saving a query fails', async () => {
      const storage = createMockStorage()
      storage.create = vi.fn().mockRejectedValue(new Error('storage error'))
      const { user } = await renderContent(storage)
      await user.type(screen.getByPlaceholderText('Query name...'), 'My Query')
      await user.click(screen.getByText('Save'))
      await waitFor(() => {
        expect(screen.getByText('Failed to save query')).toBeInTheDocument()
      })
    })

    it('shows error when deleting a query fails', async () => {
      const storage = createMockStorage()
      storage.remove = vi.fn().mockRejectedValue(new Error('storage error'))
      const { user } = await renderContent(storage)
      await user.click(screen.getAllByTitle('Delete')[0])
      await user.click(screen.getByText('Confirm'))
      await waitFor(() => {
        expect(screen.getByText('Failed to delete query')).toBeInTheDocument()
      })
    })

    it('clears error on next successful action', async () => {
      const storage = createMockStorage()
      storage.create = vi.fn().mockRejectedValueOnce(new Error('storage error'))
      const { user } = await renderContent(storage)
      await user.type(screen.getByPlaceholderText('Query name...'), 'My Query')
      await user.click(screen.getByText('Save'))
      await waitFor(() => {
        expect(screen.getByText('Failed to save query')).toBeInTheDocument()
      })
      // Retry — create succeeds this time, error clears at start of action
      storage.create = vi.fn().mockResolvedValue([])
      await user.type(screen.getByPlaceholderText('Query name...'), 'My Query')
      await user.click(screen.getByText('Save'))
      await waitFor(() => {
        expect(screen.queryByText('Failed to save query')).not.toBeInTheDocument()
      })
    })
  })
})
