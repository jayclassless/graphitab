import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function mockHook(requests: GraphQLRequest[], clear = vi.fn()) {
  mockUseGraphQLRequests.mockReturnValue({ requests, clear })
}

describe('DevTools Panel App', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all 5 column headers', () => {
    mockHook([])
    render(<App />)
    expect(screen.getByText('Operation')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('URL')).toBeInTheDocument()
  })

  it('shows empty state when hook returns []', () => {
    mockHook([])
    render(<App />)
    expect(screen.getByText('No GraphQL requests recorded.')).toBeInTheDocument()
  })

  it('renders a row per request with operation name, status, and URL', () => {
    mockHook([
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
    mockHook([makeRequest({ size: 512 })])
    render(<App />)
    expect(screen.getByText('512 B')).toBeInTheDocument()
  })

  it('prettyMs formats time correctly: 123 → "123ms"', () => {
    mockHook([makeRequest({ time: 123 })])
    render(<App />)
    expect(screen.getByText('123ms')).toBeInTheDocument()
  })

  it('shows Q badge for query operations', () => {
    mockHook([makeRequest({ operationType: 'query' })])
    render(<App />)
    const badge = screen.getByText('Q')
    expect(badge).toHaveClass('gt-op-badge--query')
  })

  it('shows M badge for mutation operations', () => {
    mockHook([makeRequest({ operationType: 'mutation' })])
    render(<App />)
    const badge = screen.getByText('M')
    expect(badge).toHaveClass('gt-op-badge--mutation')
  })

  it('shows S badge for subscription operations', () => {
    mockHook([makeRequest({ operationType: 'subscription' })])
    render(<App />)
    const badge = screen.getByText('S')
    expect(badge).toHaveClass('gt-op-badge--subscription')
  })

  it('shows Q badge for unknown operations', () => {
    mockHook([makeRequest({ operationType: 'unknown' })])
    render(<App />)
    const badge = screen.getByText('Q')
    expect(badge).toHaveClass('gt-op-badge--unknown')
  })

  it('shows success dot for 2xx status', () => {
    mockHook([makeRequest({ status: 200 })])
    const { container } = render(<App />)
    expect(container.querySelector('.gt-status-dot--success')).toBeInTheDocument()
    expect(container.querySelector('.gt-status-dot--error')).not.toBeInTheDocument()
  })

  it('shows error dot for 4xx status', () => {
    mockHook([makeRequest({ status: 400 })])
    const { container } = render(<App />)
    expect(container.querySelector('.gt-status-dot--error')).toBeInTheDocument()
    expect(container.querySelector('.gt-status-dot--success')).not.toBeInTheDocument()
  })

  it('shows error dot for 5xx status', () => {
    mockHook([makeRequest({ status: 500 })])
    const { container } = render(<App />)
    expect(container.querySelector('.gt-status-dot--error')).toBeInTheDocument()
  })

  it('Clear button calls clear() when clicked', async () => {
    const clear = vi.fn()
    mockHook([], clear)
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear network log' }))
    expect(clear).toHaveBeenCalledOnce()
  })

  it('renders two filter buttons (Query, Mutation) initially active', () => {
    mockHook([])
    render(<App />)
    expect(screen.getByRole('button', { name: 'Query' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Mutation' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Subscription' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unknown' })).not.toBeInTheDocument()
  })

  it('clicking Query button deactivates it; Query rows hidden, Mutation rows still shown', async () => {
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

  it('clicking Mutation button deactivates it; Mutation rows hidden', async () => {
    mockHook([makeRequest({ id: '1', operationType: 'mutation', operationName: 'CreateUser' })])
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Mutation' }))
    expect(screen.getByRole('button', { name: 'Mutation' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.queryByText('CreateUser')).not.toBeInTheDocument()
  })

  it('re-clicking a deactivated filter button reactivates it', async () => {
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

  it('Preserve log checkbox is unchecked by default', () => {
    mockHook([])
    render(<App />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('clicking the Preserve log checkbox checks it', async () => {
    mockHook([])
    render(<App />)
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })
})
