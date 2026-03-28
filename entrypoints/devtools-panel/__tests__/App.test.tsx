import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { cloneElement, type ReactElement } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

vi.mock('../App.css', () => ({}))
vi.mock('../ContextMenu.css', () => ({}))
vi.mock('../RequestModal.css', () => ({}))
vi.mock('graphiql/style.css', () => ({}))
vi.mock('react-window', () => ({
  List: (props: Record<string, unknown>) => {
    const { rowComponent, rowCount, rowProps } = props as {
      rowComponent: (p: object) => ReactElement
      rowCount: number
      rowProps: object
    }
    return Array.from({ length: rowCount }, (_, i) =>
      cloneElement(rowComponent({ ariaAttributes: {}, index: i, style: {}, ...rowProps }), {
        key: i,
      })
    )
  },
}))
vi.mock('../useGraphQLRequests', () => ({ useGraphQLRequests: vi.fn() }))

import App from '../App'
import type { GraphQLRequest, TableEntry, NavigationDivider } from '../har'
import { useGraphQLRequests } from '../useGraphQLRequests'

const mockUseGraphQLRequests = vi.mocked(useGraphQLRequests)

function makeRequest(overrides: Partial<GraphQLRequest> = {}): GraphQLRequest {
  return {
    id: '1',
    operationName: 'GetHero',
    operationType: 'query',
    status: 200,
    size: 512,
    time: 123,
    url: 'https://api.example.com/graphql',
    method: 'POST',
    headers: [],
    query: 'query GetHero { hero { name } }',
    ...overrides,
  }
}

function makeDivider(overrides: Partial<NavigationDivider> = {}): NavigationDivider {
  return {
    kind: 'navigation-divider',
    id: 'nav-1',
    url: 'https://example.com/page',
    ...overrides,
  }
}

function mockHook(entries: TableEntry[], clear = vi.fn()) {
  mockUseGraphQLRequests.mockReturnValue({ entries, clear })
}

describe('DevTools Panel App', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Column headers', () => {
    it('renders all 5 column headers', () => {
      mockHook([])
      render(<App />)
      expect(screen.getByText('Operation')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Size')).toBeInTheDocument()
      expect(screen.getByText('Time')).toBeInTheDocument()
      expect(screen.getByText('URL')).toBeInTheDocument()
    })
  })

  describe('Row rendering', () => {
    it('shows empty state when there are no requests', () => {
      mockHook([])
      render(<App />)
      expect(screen.getByText('No GraphQL requests recorded.')).toBeInTheDocument()
    })

    it('renders one row per visible request', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationName: 'CreateUser', operationType: 'mutation' }),
        makeRequest({ id: '3', operationName: 'OnUpdate', operationType: 'subscription' }),
      ])
      render(<App />)
      expect(document.querySelectorAll('.gt-network-row')).toHaveLength(3)
    })

    it('renders operation name, status, and URL for each row', () => {
      mockHook([
        makeRequest({
          id: '1',
          operationName: 'GetHero',
          status: 200,
          url: 'https://a.example.com/graphql',
        }),
        makeRequest({
          id: '2',
          operationName: 'CreateUser',
          status: 201,
          url: 'https://b.example.com/graphql',
        }),
      ])
      render(<App />)
      expect(screen.getByText('GetHero')).toBeInTheDocument()
      expect(screen.getByText('CreateUser')).toBeInTheDocument()
      expect(screen.getByText('200')).toBeInTheDocument()
      expect(screen.getByText('201')).toBeInTheDocument()
      expect(screen.getByText('https://a.example.com/graphql')).toBeInTheDocument()
      expect(screen.getByText('https://b.example.com/graphql')).toBeInTheDocument()
    })

    it('shows success status dot for 2xx responses and error dot for 4xx/5xx', () => {
      mockHook([makeRequest({ id: '1', status: 200 }), makeRequest({ id: '2', status: 500 })])
      const { container } = render(<App />)
      expect(container.querySelectorAll('.gt-status-dot--success')).toHaveLength(1)
      expect(container.querySelectorAll('.gt-status-dot--error')).toHaveLength(1)
    })
  })

  describe('Clear button', () => {
    it('Clear button calls clear() when clicked', async () => {
      const clear = vi.fn()
      mockHook([], clear)
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Clear network log' }))
      expect(clear).toHaveBeenCalledOnce()
    })
  })

  describe('Type filter', () => {
    it('renders Query, Mutation, and Batch filter buttons, all initially active', () => {
      mockHook([])
      render(<App />)
      expect(screen.getByRole('button', { name: 'Query' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Mutation' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(screen.getByRole('button', { name: 'Batch' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByRole('button', { name: 'Subscription' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Unknown' })).not.toBeInTheDocument()
    })

    it('deactivating Query hides query rows but keeps mutation rows', async () => {
      mockHook([
        makeRequest({ id: '1', operationType: 'query', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationType: 'mutation', operationName: 'CreateUser' }),
      ])
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Query' }))
      expect(screen.getByRole('button', { name: 'Query' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByText('GetHero')).not.toBeInTheDocument()
      expect(screen.getByText('CreateUser')).toBeInTheDocument()
    })

    it('deactivating Mutation hides mutation rows but keeps query rows', async () => {
      mockHook([
        makeRequest({ id: '1', operationType: 'query', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationType: 'mutation', operationName: 'CreateUser' }),
      ])
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Mutation' }))
      expect(screen.getByRole('button', { name: 'Mutation' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      expect(screen.queryByText('CreateUser')).not.toBeInTheDocument()
      expect(screen.getByText('GetHero')).toBeInTheDocument()
    })

    it('deactivating both filters hides all query/mutation rows and shows empty state', async () => {
      mockHook([
        makeRequest({ id: '1', operationType: 'query', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationType: 'mutation', operationName: 'CreateUser' }),
      ])
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Query' }))
      await userEvent.click(screen.getByRole('button', { name: 'Mutation' }))
      expect(screen.queryByText('GetHero')).not.toBeInTheDocument()
      expect(screen.queryByText('CreateUser')).not.toBeInTheDocument()
      expect(screen.getByText('No GraphQL requests recorded.')).toBeInTheDocument()
    })

    it('re-clicking a deactivated filter reactivates it and shows the rows again', async () => {
      mockHook([makeRequest({ id: '1', operationType: 'query', operationName: 'GetHero' })])
      render(<App />)
      const queryBtn = screen.getByRole('button', { name: 'Query' })
      await userEvent.click(queryBtn)
      expect(queryBtn).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByText('GetHero')).not.toBeInTheDocument()
      await userEvent.click(queryBtn)
      expect(queryBtn).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('GetHero')).toBeInTheDocument()
    })

    it('subscription and unknown requests are always shown regardless of filter state', async () => {
      mockHook([
        makeRequest({ id: '1', operationType: 'subscription', operationName: 'OnUpdate' }),
        makeRequest({ id: '2', operationType: 'unknown', operationName: 'Mystery' }),
        makeRequest({ id: '3', operationType: 'query', operationName: 'GetHero' }),
      ])
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Query' }))
      await userEvent.click(screen.getByRole('button', { name: 'Mutation' }))
      expect(screen.getByText('OnUpdate')).toBeInTheDocument()
      expect(screen.getByText('Mystery')).toBeInTheDocument()
      expect(screen.queryByText('GetHero')).not.toBeInTheDocument()
    })

    it('deactivating Batch hides batch rows but keeps query/mutation rows', async () => {
      mockHook([
        makeRequest({ id: '1', operationType: 'query', operationName: 'GetHero' }),
        makeRequest({
          id: '2',
          operationType: 'batch',
          operationName: 'GetHero',
          batchedOperations: [
            {
              operationName: 'GetHero',
              operationType: 'query',
              query: 'query GetHero { hero { name } }',
            },
            {
              operationName: 'GetVillain',
              operationType: 'query',
              query: 'query GetVillain { villain { name } }',
            },
          ],
        }),
      ])
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Batch' }))
      expect(screen.getByRole('button', { name: 'Batch' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getAllByText('GetHero')).toHaveLength(1)
    })

    it('re-clicking a deactivated Batch filter reactivates it and shows batch rows', async () => {
      mockHook([
        makeRequest({
          id: '1',
          operationType: 'batch',
          operationName: 'BatchedOp',
          batchedOperations: [
            { operationName: 'BatchedOp', operationType: 'query', query: '{ hero }' },
          ],
        }),
      ])
      render(<App />)
      const batchBtn = screen.getByRole('button', { name: 'Batch' })
      await userEvent.click(batchBtn)
      expect(screen.queryByText('BatchedOp')).not.toBeInTheDocument()
      await userEvent.click(batchBtn)
      expect(screen.getByText('BatchedOp')).toBeInTheDocument()
    })
  })

  describe('Preserve log', () => {
    it('Preserve log checkbox is unchecked by default', () => {
      mockHook([])
      render(<App />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('clicking the Preserve log checkbox checks it', async () => {
      mockHook([])
      render(<App />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('checkbox')).toBeChecked()
    })

    it('calls useGraphQLRequests(true) by default (clear on navigation)', () => {
      mockHook([])
      render(<App />)
      expect(mockUseGraphQLRequests).toHaveBeenCalledWith(true)
    })

    it('calls useGraphQLRequests(false) after enabling Preserve log (keep log on navigation)', async () => {
      mockHook([])
      render(<App />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(mockUseGraphQLRequests).toHaveBeenLastCalledWith(false)
    })
  })

  describe('Column resize', () => {
    it('renders 4 resize handles (one per resizable header cell)', () => {
      mockHook([])
      render(<App />)
      expect(document.querySelectorAll('.gt-col-resize-handle')).toHaveLength(4)
    })

    it('initial --gt-col-widths is 200px 100px 100px 100px 1fr', () => {
      mockHook([])
      render(<App />)
      const panel = document.querySelector('.gt-devtools-panel') as HTMLElement
      expect(panel.style.getPropertyValue('--gt-col-widths')).toBe('200px 100px 100px 100px 1fr')
    })

    it.each([
      {
        handleIndex: 0,
        label: 'Operation',
        defaultWidth: 200,
        delta: 50,
        expected: '250px 100px 100px 100px 1fr',
      },
      {
        handleIndex: 1,
        label: 'Status',
        defaultWidth: 100,
        delta: 40,
        expected: '200px 140px 100px 100px 1fr',
      },
      {
        handleIndex: 2,
        label: 'Size',
        defaultWidth: 100,
        delta: 30,
        expected: '200px 100px 130px 100px 1fr',
      },
      {
        handleIndex: 3,
        label: 'Time',
        defaultWidth: 100,
        delta: 20,
        expected: '200px 100px 100px 120px 1fr',
      },
    ])(
      'dragging handle[$handleIndex] ($label) updates only that column',
      ({ handleIndex, delta, expected }) => {
        mockHook([])
        render(<App />)
        const panel = document.querySelector('.gt-devtools-panel') as HTMLElement
        const handles = document.querySelectorAll('.gt-col-resize-handle')

        fireEvent.mouseDown(handles[handleIndex], { clientX: 100 })
        fireEvent.mouseMove(document, { clientX: 100 + delta })

        expect(panel.style.getPropertyValue('--gt-col-widths')).toBe(expected)
      }
    )

    it('column width is clamped to MIN_COL_WIDTH (40px) when dragged far left', () => {
      mockHook([])
      render(<App />)
      const panel = document.querySelector('.gt-devtools-panel') as HTMLElement
      const handles = document.querySelectorAll('.gt-col-resize-handle')

      fireEvent.mouseDown(handles[0], { clientX: 100 })
      fireEvent.mouseMove(document, { clientX: -500 })

      expect(panel.style.getPropertyValue('--gt-col-widths')).toBe('40px 100px 100px 100px 1fr')
    })

    it('mouseup ends the drag; subsequent mousemoves do not change the width', () => {
      mockHook([])
      render(<App />)
      const panel = document.querySelector('.gt-devtools-panel') as HTMLElement
      const handles = document.querySelectorAll('.gt-col-resize-handle')

      fireEvent.mouseDown(handles[0], { clientX: 100 })
      fireEvent.mouseMove(document, { clientX: 150 })
      expect(panel.style.getPropertyValue('--gt-col-widths')).toBe('250px 100px 100px 100px 1fr')

      fireEvent.mouseUp(document)
      fireEvent.mouseMove(document, { clientX: 300 })
      expect(panel.style.getPropertyValue('--gt-col-widths')).toBe('250px 100px 100px 100px 1fr')
    })

    it('each drag measures from its own mousedown origin (not cumulative)', () => {
      mockHook([])
      render(<App />)
      const panel = document.querySelector('.gt-devtools-panel') as HTMLElement
      const handles = document.querySelectorAll('.gt-col-resize-handle')

      // First drag: 200 → 250
      fireEvent.mouseDown(handles[0], { clientX: 100 })
      fireEvent.mouseMove(document, { clientX: 150 })
      fireEvent.mouseUp(document)
      expect(panel.style.getPropertyValue('--gt-col-widths')).toBe('250px 100px 100px 100px 1fr')

      // Second drag starts from new baseline (250px), move +30 → 280
      fireEvent.mouseDown(handles[0], { clientX: 200 })
      fireEvent.mouseMove(document, { clientX: 230 })
      expect(panel.style.getPropertyValue('--gt-col-widths')).toBe('280px 100px 100px 100px 1fr')
    })
  })

  describe('Context menu', () => {
    it('right-clicking a row opens the context menu', () => {
      mockHook([makeRequest()])
      render(<App />)
      const row = document.querySelector('.gt-network-row') as HTMLElement
      fireEvent.contextMenu(row, { clientX: 100, clientY: 200 })
      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('Copy URL')).toBeInTheDocument()
      expect(screen.getByText('Copy Query')).toBeInTheDocument()
    })

    it('context menu closes when clicking outside it', () => {
      mockHook([makeRequest()])
      render(<App />)
      const row = document.querySelector('.gt-network-row') as HTMLElement
      fireEvent.contextMenu(row, { clientX: 100, clientY: 200 })
      expect(screen.getByRole('menu')).toBeInTheDocument()
      fireEvent.mouseDown(document.body, { button: 0 })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  describe('Request modal', () => {
    it('left-clicking a row opens the request modal', () => {
      mockHook([makeRequest()])
      render(<App />)
      const row = document.querySelector('.gt-network-row') as HTMLElement
      fireEvent.click(row)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('modal shows the operation name of the clicked row', () => {
      mockHook([makeRequest({ operationName: 'GetHero' })])
      render(<App />)
      const row = document.querySelector('.gt-network-row') as HTMLElement
      fireEvent.click(row)
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'GetHero')
    })

    it('pressing Escape closes the modal', () => {
      mockHook([makeRequest()])
      render(<App />)
      const row = document.querySelector('.gt-network-row') as HTMLElement
      fireEvent.click(row)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('Previous request button is disabled when the first request is open', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[0])
      expect(screen.getByRole('button', { name: 'Previous request' })).toBeDisabled()
    })

    it('Next request button is disabled when the last request is open', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[1])
      expect(screen.getByRole('button', { name: 'Next request' })).toBeDisabled()
    })

    it('clicking Next request advances to the next request in the list', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[0])
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'GetHero')
      fireEvent.click(screen.getByRole('button', { name: 'Next request' }))
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'CreateUser')
    })

    it('clicking Previous request goes back to the previous request in the list', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[1])
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'CreateUser')
      fireEvent.click(screen.getByRole('button', { name: 'Previous request' }))
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'GetHero')
    })

    it('ArrowRight navigates to the next request while the modal is open', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[0])
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'CreateUser')
    })

    it('ArrowLeft navigates to the previous request while the modal is open', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[1])
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'GetHero')
    })

    it('modal prev/next skips over navigation dividers', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeDivider({ id: 'nav-1', url: 'https://example.com' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[0])
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'GetHero')
      fireEvent.click(screen.getByRole('button', { name: 'Next request' }))
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'CreateUser')
      fireEvent.click(screen.getByRole('button', { name: 'Previous request' }))
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'GetHero')
    })

    it('prev is disabled when only dividers precede the current request', () => {
      mockHook([
        makeDivider({ id: 'nav-1', url: 'https://example.com' }),
        makeRequest({ id: '1', operationName: 'GetHero' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[0])
      expect(screen.getByRole('button', { name: 'Previous request' })).toBeDisabled()
    })

    it('next is disabled when only dividers follow the current request', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeDivider({ id: 'nav-1', url: 'https://example.com' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      fireEvent.click(rows[0])
      expect(screen.getByRole('button', { name: 'Next request' })).toBeDisabled()
    })
  })

  describe('Navigation dividers', () => {
    it('renders a navigation divider row with the navigated URL', () => {
      mockHook([makeDivider({ url: 'https://example.com/page' })])
      render(<App />)
      expect(screen.getByText('https://example.com/page')).toBeInTheDocument()
      expect(document.querySelector('.gt-navigation-divider')).toBeInTheDocument()
    })

    it('clicking a navigation divider does not open a modal', () => {
      mockHook([makeDivider()])
      render(<App />)
      const divider = document.querySelector('.gt-navigation-divider') as HTMLElement
      fireEvent.click(divider)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('navigation dividers are shown regardless of operation type filters', async () => {
      mockHook([
        makeRequest({ id: '1', operationType: 'query', operationName: 'GetHero' }),
        makeDivider({ id: 'nav-1', url: 'https://example.com' }),
      ])
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Query' }))
      await userEvent.click(screen.getByRole('button', { name: 'Mutation' }))
      await userEvent.click(screen.getByRole('button', { name: 'Batch' }))
      expect(document.querySelector('.gt-navigation-divider')).toBeInTheDocument()
    })

    it('dividers interspersed with requests render in correct order', () => {
      mockHook([
        makeRequest({ id: '1', operationName: 'GetHero' }),
        makeDivider({ id: 'nav-1', url: 'https://example.com/page2' }),
        makeRequest({ id: '2', operationName: 'CreateUser' }),
      ])
      render(<App />)
      const rows = document.querySelectorAll('.gt-network-row')
      const dividers = document.querySelectorAll('.gt-navigation-divider')
      expect(rows).toHaveLength(2)
      expect(dividers).toHaveLength(1)
    })
  })
})
