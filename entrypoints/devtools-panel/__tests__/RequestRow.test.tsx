import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { GraphQLRequest, NavigationDivider } from '../har'
import { RequestRow } from '../RequestRow'

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
    headers: [{ name: 'content-type', value: 'application/json' }],
    query: 'query GetHero { hero { name } }',
    ...overrides,
  }
}

const ariaAttributes = { 'aria-posinset': 1, 'aria-setsize': 1, role: 'listitem' as const }

function renderRow(req: GraphQLRequest, onContextMenu = vi.fn(), onClick = vi.fn()) {
  return render(
    <RequestRow
      ariaAttributes={ariaAttributes}
      index={0}
      style={{}}
      visible={[req]}
      onContextMenu={onContextMenu}
      onClick={onClick}
    />
  )
}

describe('RequestRow', () => {
  afterEach(() => {
    cleanup()
  })

  it('filesize formats size correctly: 512 → "512 B"', () => {
    renderRow(makeRequest({ size: 512 }))
    expect(screen.getByText('512 B')).toBeInTheDocument()
  })

  it('prettyMs formats time correctly: 123 → "123ms"', () => {
    renderRow(makeRequest({ time: 123 }))
    expect(screen.getByText('123ms')).toBeInTheDocument()
  })

  it('shows Q badge for query operations', () => {
    renderRow(makeRequest({ operationType: 'query' }))
    expect(screen.getByText('Q')).toHaveClass('gt-op-badge--query')
  })

  it('shows M badge for mutation operations', () => {
    renderRow(makeRequest({ operationType: 'mutation' }))
    expect(screen.getByText('M')).toHaveClass('gt-op-badge--mutation')
  })

  it('shows S badge for subscription operations', () => {
    renderRow(makeRequest({ operationType: 'subscription' }))
    expect(screen.getByText('S')).toHaveClass('gt-op-badge--subscription')
  })

  it('shows Q badge for unknown operations', () => {
    renderRow(makeRequest({ operationType: 'unknown' }))
    expect(screen.getByText('Q')).toHaveClass('gt-op-badge--unknown')
  })

  it('shows B badge for batch operations', () => {
    renderRow(makeRequest({ operationType: 'batch' }))
    expect(screen.getByText('B')).toHaveClass('gt-op-badge--batch')
  })

  it('shows +N annotation when batch has multiple operations', () => {
    renderRow(
      makeRequest({
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
          {
            operationName: 'GetSidekick',
            operationType: 'query',
            query: 'query GetSidekick { sidekick { name } }',
          },
        ],
      })
    )
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('does not show +N annotation when batch has only one operation', () => {
    const { container } = renderRow(
      makeRequest({
        operationType: 'batch',
        operationName: 'GetHero',
        batchedOperations: [
          {
            operationName: 'GetHero',
            operationType: 'query',
            query: 'query GetHero { hero { name } }',
          },
        ],
      })
    )
    expect(container.querySelector('.gt-batch-extra-count')).not.toBeInTheDocument()
  })

  it('does not show +N annotation for non-batch operations', () => {
    const { container } = renderRow(makeRequest({ operationType: 'query' }))
    expect(container.querySelector('.gt-batch-extra-count')).not.toBeInTheDocument()
  })

  it('shows success dot for 2xx status', () => {
    const { container } = renderRow(makeRequest({ status: 200 }))
    expect(container.querySelector('.gt-status-dot--success')).toBeInTheDocument()
    expect(container.querySelector('.gt-status-dot--error')).not.toBeInTheDocument()
  })

  it('shows error dot for 4xx status', () => {
    const { container } = renderRow(makeRequest({ status: 400 }))
    expect(container.querySelector('.gt-status-dot--error')).toBeInTheDocument()
    expect(container.querySelector('.gt-status-dot--success')).not.toBeInTheDocument()
  })

  it('shows error dot for 5xx status', () => {
    const { container } = renderRow(makeRequest({ status: 500 }))
    expect(container.querySelector('.gt-status-dot--error')).toBeInTheDocument()
  })

  it('right-click calls onContextMenu with the request and mouse coordinates', () => {
    const onContextMenu = vi.fn()
    const req = makeRequest()
    const { container } = renderRow(req, onContextMenu)
    const row = container.firstChild as HTMLElement
    fireEvent.contextMenu(row, { clientX: 100, clientY: 200 })
    expect(onContextMenu).toHaveBeenCalledOnce()
    expect(onContextMenu).toHaveBeenCalledWith(req, 100, 200)
  })

  it('left-click calls onClick with the request', () => {
    const onClick = vi.fn()
    const req = makeRequest()
    const { container } = renderRow(req, vi.fn(), onClick)
    const row = container.firstChild as HTMLElement
    fireEvent.click(row)
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(req)
  })

  it('shows persisted indicator on badge for APQ requests', () => {
    renderRow(makeRequest({ persisted: true }))
    expect(screen.getByText('Q')).toHaveClass('gt-op-badge--persisted')
  })

  it('does not show persisted indicator on badge for non-APQ requests', () => {
    renderRow(makeRequest())
    expect(screen.getByText('Q')).not.toHaveClass('gt-op-badge--persisted')
  })

  describe('Navigation divider', () => {
    function makeDivider(overrides: Partial<NavigationDivider> = {}): NavigationDivider {
      return {
        kind: 'navigation-divider',
        id: 'nav-1',
        url: 'https://example.com/page',
        ...overrides,
      }
    }

    function renderDivider(
      divider: NavigationDivider = makeDivider(),
      onContextMenu = vi.fn(),
      onClick = vi.fn()
    ) {
      return render(
        <RequestRow
          ariaAttributes={ariaAttributes}
          index={0}
          style={{}}
          visible={[divider]}
          onContextMenu={onContextMenu}
          onClick={onClick}
        />
      )
    }

    it('renders with the navigation divider class', () => {
      renderDivider()
      expect(document.querySelector('.gt-navigation-divider')).toBeInTheDocument()
    })

    it('displays "Navigated to" with the URL', () => {
      renderDivider(makeDivider({ url: 'https://example.com/new-page' }))
      expect(screen.getByText('https://example.com/new-page')).toBeInTheDocument()
      expect(screen.getByText(/Navigated to/)).toBeInTheDocument()
    })

    it('does not render as a grid row', () => {
      renderDivider()
      expect(document.querySelector('.gt-network-row')).not.toBeInTheDocument()
    })

    it('does not call onClick when clicked', () => {
      const onClick = vi.fn()
      renderDivider(makeDivider(), vi.fn(), onClick)
      const divider = document.querySelector('.gt-navigation-divider') as HTMLElement
      fireEvent.click(divider)
      expect(onClick).not.toHaveBeenCalled()
    })

    it('does not call onContextMenu when right-clicked', () => {
      const onContextMenu = vi.fn()
      renderDivider(makeDivider(), onContextMenu)
      const divider = document.querySelector('.gt-navigation-divider') as HTMLElement
      fireEvent.contextMenu(divider)
      expect(onContextMenu).not.toHaveBeenCalled()
    })

    it('has a title attribute with the full URL', () => {
      renderDivider(makeDivider({ url: 'https://example.com/very-long-url' }))
      const label = document.querySelector('.gt-navigation-divider-label') as HTMLElement
      expect(label).toHaveAttribute('title', 'https://example.com/very-long-url')
    })
  })
})
