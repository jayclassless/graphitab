import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ResponseTab.css', () => ({}))
vi.mock('@microlink/react-json-view', () => ({
  default: ({ src }: { src: object }) => (
    <div data-testid="json-view" data-src={JSON.stringify(src)} />
  ),
}))

import type { GraphQLRequest } from '../har'
import { ResponseTab } from '../ResponseTab'

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

describe('ResponseTab', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false }))
    )
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  it('shows empty state when response is undefined', () => {
    render(<ResponseTab request={makeRequest({ response: undefined })} />)
    expect(screen.getByText('No response body')).toBeInTheDocument()
  })

  it('does not render the Body heading when response is undefined', () => {
    render(<ResponseTab request={makeRequest({ response: undefined })} />)
    expect(screen.queryByText('Body')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Body section
  // ---------------------------------------------------------------------------

  it('renders "Body" heading when response is present', () => {
    render(<ResponseTab request={makeRequest({ response: '{"data":{"hero":{"name":"Luke"}}}' })} />)
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders ReactJsonView with parsed response when response is valid JSON object', () => {
    const response = '{"data":{"hero":{"name":"Luke"}}}'
    render(<ResponseTab request={makeRequest({ response })} />)
    const jsonView = screen.getByTestId('json-view')
    expect(jsonView).toBeInTheDocument()
    expect(JSON.parse(jsonView.getAttribute('data-src')!)).toEqual({
      data: { hero: { name: 'Luke' } },
    })
  })

  it('falls back to <pre> display when response is not valid JSON', () => {
    render(<ResponseTab request={makeRequest({ response: 'not-json' })} />)
    expect(screen.queryByTestId('json-view')).not.toBeInTheDocument()
    const pres = document.querySelectorAll('pre')
    const fallback = Array.from(pres).find((p) => p.textContent === 'not-json')
    expect(fallback).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Copy button
  // ---------------------------------------------------------------------------

  it('copy button is present when response is present', () => {
    render(<ResponseTab request={makeRequest({ response: '{"data":{}}' })} />)
    expect(screen.getByTitle('Copy response')).toBeInTheDocument()
  })

  it('clicking copy response copies prettified JSON when Raw is inactive and response is valid JSON', () => {
    const response = '{"data":{}}'
    render(<ResponseTab request={makeRequest({ response })} />)
    fireEvent.click(screen.getByTitle('Copy response'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify({ data: {} }, null, 2)
    )
  })

  it('clicking copy response copies raw string when Raw is active', () => {
    const response = '{"data":{}}'
    render(<ResponseTab request={makeRequest({ response })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
    fireEvent.click(screen.getByTitle('Copy response'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(response)
  })

  it('clicking copy response copies raw string when response is not valid JSON', () => {
    const response = 'not-json'
    render(<ResponseTab request={makeRequest({ response })} />)
    fireEvent.click(screen.getByTitle('Copy response'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(response)
  })

  // ---------------------------------------------------------------------------
  // Raw toggle
  // ---------------------------------------------------------------------------

  it('Raw toggle button is present when response is present', () => {
    render(<ResponseTab request={makeRequest({ response: '{"data":{}}' })} />)
    const btn = screen.getByRole('button', { name: 'Raw' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('title', 'Display original, unformatted value')
  })

  it('Raw toggle is inactive by default', () => {
    render(<ResponseTab request={makeRequest({ response: '{"data":{}}' })} />)
    expect(screen.getByRole('button', { name: 'Raw' })).not.toHaveClass('gt-raw-toggle--active')
  })

  it('clicking Raw toggle shows raw response in <pre><code>', () => {
    const response = '{"data":{}}'
    render(<ResponseTab request={makeRequest({ response })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
    expect(screen.queryByTestId('json-view')).not.toBeInTheDocument()
    const pre = document.querySelector('pre')
    expect(pre?.textContent).toBe(response)
  })

  it('clicking Raw toggle marks the button as active', () => {
    render(<ResponseTab request={makeRequest({ response: '{"data":{}}' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
    expect(screen.getByRole('button', { name: 'Raw' })).toHaveClass('gt-raw-toggle--active')
  })

  it('clicking Raw toggle again reverts to ReactJsonView', () => {
    const response = '{"data":{}}'
    render(<ResponseTab request={makeRequest({ response })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
    expect(screen.getByTestId('json-view')).toBeInTheDocument()
  })
})
