import { cleanup, render, screen } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../App.css', () => ({}))
vi.mock('graphiql/style.css', () => ({}))
vi.mock('../useGraphQLRequests', () => ({ useGraphQLRequests: vi.fn() }))

import App from '../App'
import type { GraphQLRequest } from '../har'
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
    ...overrides,
  }
}

describe('DevTools Panel App', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all 5 column headers', () => {
    mockUseGraphQLRequests.mockReturnValue([])
    render(<App />)
    expect(screen.getByText('Operation')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('URL')).toBeInTheDocument()
  })

  it('shows empty state when hook returns []', () => {
    mockUseGraphQLRequests.mockReturnValue([])
    render(<App />)
    expect(screen.getByText('No GraphQL requests recorded.')).toBeInTheDocument()
  })

  it('renders a row per request with operation name, status, and URL', () => {
    mockUseGraphQLRequests.mockReturnValue([
      makeRequest({
        id: '1',
        operationName: 'GetHero',
        status: 200,
        url: 'https://api.example.com/graphql',
      }),
      makeRequest({
        id: '2',
        operationName: 'CreateUser',
        status: 201,
        url: 'https://api.example.com/graphql',
      }),
    ])
    render(<App />)
    expect(screen.getByText('GetHero')).toBeInTheDocument()
    expect(screen.getByText('CreateUser')).toBeInTheDocument()
    expect(screen.getAllByText('200')).toHaveLength(1)
    expect(screen.getByText('201')).toBeInTheDocument()
    expect(screen.getAllByText('https://api.example.com/graphql')).toHaveLength(2)
  })

  it('filesize formats size correctly: 512 → "512 B"', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ size: 512 })])
    render(<App />)
    expect(screen.getByText('512 B')).toBeInTheDocument()
  })

  it('prettyMs formats time correctly: 123 → "123ms"', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ time: 123 })])
    render(<App />)
    expect(screen.getByText('123ms')).toBeInTheDocument()
  })

  it('shows Q badge for query operations', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ operationType: 'query' })])
    render(<App />)
    const badge = screen.getByText('Q')
    expect(badge).toHaveClass('gt-op-badge--query')
  })

  it('shows M badge for mutation operations', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ operationType: 'mutation' })])
    render(<App />)
    const badge = screen.getByText('M')
    expect(badge).toHaveClass('gt-op-badge--mutation')
  })

  it('shows S badge for subscription operations', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ operationType: 'subscription' })])
    render(<App />)
    const badge = screen.getByText('S')
    expect(badge).toHaveClass('gt-op-badge--subscription')
  })

  it('shows Q badge for unknown operations', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ operationType: 'unknown' })])
    render(<App />)
    const badge = screen.getByText('Q')
    expect(badge).toHaveClass('gt-op-badge--unknown')
  })

  it('shows success dot for 2xx status', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ status: 200 })])
    const { container } = render(<App />)
    expect(container.querySelector('.gt-status-dot--success')).toBeInTheDocument()
    expect(container.querySelector('.gt-status-dot--error')).not.toBeInTheDocument()
  })

  it('shows error dot for 4xx status', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ status: 400 })])
    const { container } = render(<App />)
    expect(container.querySelector('.gt-status-dot--error')).toBeInTheDocument()
    expect(container.querySelector('.gt-status-dot--success')).not.toBeInTheDocument()
  })

  it('shows error dot for 5xx status', () => {
    mockUseGraphQLRequests.mockReturnValue([makeRequest({ status: 500 })])
    const { container } = render(<App />)
    expect(container.querySelector('.gt-status-dot--error')).toBeInTheDocument()
  })
})
