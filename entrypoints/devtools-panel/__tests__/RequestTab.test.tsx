import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../RequestTab.css', () => ({}))
vi.mock('@microlink/react-json-view', () => ({
  default: ({ src, theme }: { src: object; theme?: string }) => (
    <div data-testid="json-view" data-src={JSON.stringify(src)} data-theme={theme} />
  ),
}))

import type { GraphQLRequest } from '../har'
import { RequestTab } from '../RequestTab'

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

describe('RequestTab', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    )
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  describe('Query section', () => {
    it('renders a "Query" section heading', () => {
      render(<RequestTab request={makeRequest()} />)
      expect(screen.getByText('Query')).toBeInTheDocument()
    })

    it('displays the query text in a code block', () => {
      render(<RequestTab request={makeRequest()} />)
      const code = document.querySelector('pre code')
      expect(code).not.toBeNull()
      expect(code!.textContent).toContain('GetHero')
    })

    it('formats a compact query using print()', () => {
      render(<RequestTab request={makeRequest({ query: 'query GetHero{hero{name}}' })} />)
      const code = document.querySelector('pre code')
      // print() adds whitespace/newlines around braces
      expect(code!.textContent).toMatch(/GetHero\s*\{/)
      expect(code!.textContent).toContain('\n')
    })

    it('falls back to raw query string when the query is invalid GraphQL', () => {
      const raw = '!@#invalid graphql'
      render(<RequestTab request={makeRequest({ query: raw })} />)
      const code = document.querySelector('pre code')
      expect(code!.textContent).toBe(raw)
    })

    it('copy button is present in the Query section', () => {
      render(<RequestTab request={makeRequest()} />)
      expect(screen.getByTitle('Copy query')).toBeInTheDocument()
    })

    it('clicking copy query button writes the formatted query to clipboard', () => {
      render(<RequestTab request={makeRequest({ query: 'query GetHero { hero { name } }' })} />)
      fireEvent.click(screen.getByTitle('Copy query'))
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('GetHero'))
    })

    it('renders a "Raw" toggle button in the Query section', () => {
      render(<RequestTab request={makeRequest()} />)
      const btn = screen.getByRole('button', { name: 'Raw' })
      expect(btn).toBeInTheDocument()
      expect(btn).toHaveAttribute('title', 'Display original, unformatted value')
    })

    it('Raw toggle is inactive by default', () => {
      render(<RequestTab request={makeRequest()} />)
      expect(screen.getByRole('button', { name: 'Raw' })).not.toHaveClass('gt-raw-toggle--active')
    })

    it('clicking Raw toggle shows the unformatted query without syntax highlighting', () => {
      const compactQuery = 'query GetHero{hero{name}}'
      render(<RequestTab request={makeRequest({ query: compactQuery })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
      const code = document.querySelector('pre code')
      expect(code!.textContent).toBe(compactQuery)
      expect(code!.innerHTML).toBe(compactQuery)
    })

    it('clicking Raw toggle marks the button as active', () => {
      render(<RequestTab request={makeRequest()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
      expect(screen.getByRole('button', { name: 'Raw' })).toHaveClass('gt-raw-toggle--active')
    })

    it('clicking Raw toggle again reverts to formatted query', () => {
      const compactQuery = 'query GetHero{hero{name}}'
      render(<RequestTab request={makeRequest({ query: compactQuery })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
      fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
      const code = document.querySelector('pre code')
      expect(code!.textContent).not.toBe(compactQuery)
      expect(code!.textContent).toContain('\n')
    })

    it('copy button copies the raw query when Raw toggle is active', () => {
      const compactQuery = 'query GetHero{hero{name}}'
      render(<RequestTab request={makeRequest({ query: compactQuery })} />)
      fireEvent.click(screen.getByRole('button', { name: 'Raw' }))
      fireEvent.click(screen.getByTitle('Copy query'))
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(compactQuery)
    })
  })

  describe('Variables section', () => {
    it('Variables section is absent when variables is undefined', () => {
      render(<RequestTab request={makeRequest({ variables: undefined })} />)
      expect(screen.queryByText('Variables')).not.toBeInTheDocument()
    })

    it('renders "Variables" heading when variables is present', () => {
      render(<RequestTab request={makeRequest({ variables: '{"id":"1"}' })} />)
      expect(screen.getByText('Variables')).toBeInTheDocument()
    })

    it('Variables section is absent when variables is an empty object', () => {
      render(<RequestTab request={makeRequest({ variables: '{}' })} />)
      expect(screen.queryByText('Variables')).not.toBeInTheDocument()
    })

    it('renders ReactJsonView with parsed variables when variables is valid JSON object', () => {
      render(<RequestTab request={makeRequest({ variables: '{"id":"1"}' })} />)
      const jsonView = screen.getByTestId('json-view')
      expect(jsonView).toBeInTheDocument()
      expect(JSON.parse(jsonView.getAttribute('data-src')!)).toEqual({ id: '1' })
    })

    it('uses monokai theme in dark mode', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      )
      render(<RequestTab request={makeRequest({ variables: '{"id":"1"}' })} />)
      expect(screen.getByTestId('json-view').getAttribute('data-theme')).toBe('monokai')
    })

    it('falls back to <pre> display when variables is not valid JSON', () => {
      render(<RequestTab request={makeRequest({ variables: 'not-json' })} />)
      expect(screen.queryByTestId('json-view')).not.toBeInTheDocument()
      // The fallback pre block contains the raw string
      const pres = document.querySelectorAll('pre')
      const fallback = Array.from(pres).find((p) => p.textContent === 'not-json')
      expect(fallback).toBeDefined()
    })

    it('falls back to <pre> display when variables is a JSON array', () => {
      render(<RequestTab request={makeRequest({ variables: '[1,2,3]' })} />)
      expect(screen.queryByTestId('json-view')).not.toBeInTheDocument()
      const pres = document.querySelectorAll('pre')
      const fallback = Array.from(pres).find((p) => p.textContent === '[1,2,3]')
      expect(fallback).toBeDefined()
    })

    it('copy button is present in the Variables section', () => {
      render(<RequestTab request={makeRequest({ variables: '{"id":"1"}' })} />)
      expect(screen.getByTitle('Copy variables')).toBeInTheDocument()
    })

    it('clicking copy variables button writes the variables string to clipboard', () => {
      const variables = '{\n  "id": "1"\n}'
      render(<RequestTab request={makeRequest({ variables })} />)
      fireEvent.click(screen.getByTitle('Copy variables'))
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(variables)
    })
  })

  describe('Extensions section', () => {
    it('Extensions section is absent when extensions is undefined', () => {
      render(<RequestTab request={makeRequest({ extensions: undefined })} />)
      expect(screen.queryByText('Extensions')).not.toBeInTheDocument()
    })

    it('renders "Extensions" heading when extensions is present', () => {
      render(<RequestTab request={makeRequest({ extensions: '{"tracing":true}' })} />)
      expect(screen.getByText('Extensions')).toBeInTheDocument()
    })

    it('Extensions section is absent when extensions is an empty object', () => {
      render(<RequestTab request={makeRequest({ extensions: '{}' })} />)
      expect(screen.queryByText('Extensions')).not.toBeInTheDocument()
    })

    it('renders ReactJsonView with parsed extensions when extensions is valid JSON object', () => {
      render(<RequestTab request={makeRequest({ extensions: '{"tracing":true}' })} />)
      const jsonView = screen.getByTestId('json-view')
      expect(jsonView).toBeInTheDocument()
      expect(JSON.parse(jsonView.getAttribute('data-src')!)).toEqual({ tracing: true })
    })

    it('falls back to <pre> display when extensions is not valid JSON', () => {
      render(<RequestTab request={makeRequest({ extensions: 'not-json' })} />)
      expect(screen.queryByTestId('json-view')).not.toBeInTheDocument()
      const pres = document.querySelectorAll('pre')
      const fallback = Array.from(pres).find((p) => p.textContent === 'not-json')
      expect(fallback).toBeDefined()
    })

    it('falls back to <pre> display when extensions is a JSON array', () => {
      render(<RequestTab request={makeRequest({ extensions: '[1,2,3]' })} />)
      expect(screen.queryByTestId('json-view')).not.toBeInTheDocument()
      const pres = document.querySelectorAll('pre')
      const fallback = Array.from(pres).find((p) => p.textContent === '[1,2,3]')
      expect(fallback).toBeDefined()
    })

    it('copy button is present in the Extensions section', () => {
      render(<RequestTab request={makeRequest({ extensions: '{"tracing":true}' })} />)
      expect(screen.getByTitle('Copy extensions')).toBeInTheDocument()
    })

    it('clicking copy extensions button writes the extensions string to clipboard', () => {
      const extensions = '{\n  "tracing": true\n}'
      render(<RequestTab request={makeRequest({ extensions })} />)
      fireEvent.click(screen.getByTitle('Copy extensions'))
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(extensions)
    })
  })

  describe('Raw Body toggle', () => {
    const title = 'Toggle between parsed and raw body view'

    it('toggle button is absent when rawBody is undefined', () => {
      render(<RequestTab request={makeRequest({ rawBody: undefined })} />)
      expect(screen.queryByTitle(title)).not.toBeInTheDocument()
    })

    it('toggle button is present when rawBody is defined', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      expect(screen.getByTitle(title)).toBeInTheDocument()
    })

    it('toggle is labeled "Full Raw Body" by default', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      expect(screen.getByTitle(title)).toHaveTextContent('Full Raw Body')
    })

    it('toggle is inactive by default', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      expect(screen.getByTitle(title)).not.toHaveClass('gt-raw-toggle--active')
    })

    it('structured sections are visible by default', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      expect(screen.getByText('Query')).toBeInTheDocument()
    })

    it('Raw Body section is hidden by default', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      expect(screen.queryByText('Raw Body')).not.toBeInTheDocument()
    })

    it('clicking toggle shows Raw Body section and hides structured sections', () => {
      const rawBody = '{"query":"{ hero }","variables":{"id":"1"}}'
      render(<RequestTab request={makeRequest({ rawBody })} />)
      fireEvent.click(screen.getByTitle(title))
      expect(screen.getByText('Raw Body')).toBeInTheDocument()
      expect(screen.queryByText('Query')).not.toBeInTheDocument()
    })

    it('toggle label changes to "Parsed Body" when active', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      fireEvent.click(screen.getByTitle(title))
      expect(screen.getByTitle(title)).toHaveTextContent('Parsed Body')
    })

    it('clicking toggle marks it as active', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      fireEvent.click(screen.getByTitle(title))
      expect(screen.getByTitle(title)).toHaveClass('gt-raw-toggle--active')
    })

    it('clicking toggle again restores structured sections', () => {
      render(<RequestTab request={makeRequest({ rawBody: '{"query":"{ hero }"}' })} />)
      fireEvent.click(screen.getByTitle(title))
      fireEvent.click(screen.getByTitle(title))
      expect(screen.getByText('Query')).toBeInTheDocument()
      expect(screen.queryByText('Raw Body')).not.toBeInTheDocument()
    })

    it('displays the raw body verbatim in a code block when toggled', () => {
      const rawBody = '{"query":"{ hero }","variables":{"id":"1"}}'
      render(<RequestTab request={makeRequest({ rawBody })} />)
      fireEvent.click(screen.getByTitle(title))
      const pres = document.querySelectorAll('pre')
      const block = Array.from(pres).find((p) => p.textContent === rawBody)
      expect(block).toBeDefined()
    })

    it('copy button in Raw Body section writes raw body to clipboard', () => {
      const rawBody = '{"query":"{ hero }","variables":{"id":"1"}}'
      render(<RequestTab request={makeRequest({ rawBody })} />)
      fireEvent.click(screen.getByTitle(title))
      fireEvent.click(screen.getByTitle('Copy raw body'))
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rawBody)
    })
  })
})
