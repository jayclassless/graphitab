import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { GraphQLRequest } from '../har'
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
    query: 'query GetHero { hero { name } }',
    ...overrides,
  }
}

const ariaAttributes = { 'aria-posinset': 1, 'aria-setsize': 1, role: 'listitem' as const }

function renderRow(req: GraphQLRequest, onContextMenu = vi.fn()) {
  return render(
    <RequestRow
      ariaAttributes={ariaAttributes}
      index={0}
      style={{}}
      visible={[req]}
      onContextMenu={onContextMenu}
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
})
