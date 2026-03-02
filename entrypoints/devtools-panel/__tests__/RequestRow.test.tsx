import { cleanup, render, screen } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { RequestRow } from '../RequestRow'
import type { GraphQLRequest } from '../har'

function makeRequest(overrides: Partial<GraphQLRequest> = {}): GraphQLRequest {
  return {
    id: '1',
    operationName: 'GetHero',
    operationType: 'query',
    status: 200,
    size: 512,
    time: 123,
    url: 'https://api.example.com/graphql',
    ...overrides,
  }
}

const ariaAttributes = { 'aria-posinset': 1, 'aria-setsize': 1, role: 'listitem' as const }

function renderRow(req: GraphQLRequest) {
  return render(<RequestRow ariaAttributes={ariaAttributes} index={0} style={{}} visible={[req]} />)
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
})
