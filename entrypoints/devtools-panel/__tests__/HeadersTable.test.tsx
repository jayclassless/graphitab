import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { HeadersTable } from '../HeadersTable'

describe('HeadersTable', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the given title', () => {
    render(<HeadersTable title="Request Headers" />)
    expect(screen.getByText('Request Headers')).toBeInTheDocument()
  })

  it('renders header names and values in table rows', () => {
    render(
      <HeadersTable
        title="Request Headers"
        headers={[
          { name: 'content-type', value: 'application/json' },
          { name: 'authorization', value: 'Bearer token' },
        ]}
      />
    )
    expect(screen.getByText('content-type')).toBeInTheDocument()
    expect(screen.getByText('application/json')).toBeInTheDocument()
    expect(screen.getByText('authorization')).toBeInTheDocument()
    expect(screen.getByText('Bearer token')).toBeInTheDocument()
  })

  it('renders Name and Value column headings when headers are present', () => {
    render(<HeadersTable title="Request Headers" headers={[{ name: 'x-foo', value: 'bar' }]} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
  })

  it('shows "No headers" when headers is undefined', () => {
    render(<HeadersTable title="Response Headers" />)
    expect(screen.getByText('No headers')).toBeInTheDocument()
  })

  it('shows "No headers" when headers is an empty array', () => {
    render(<HeadersTable title="Response Headers" headers={[]} />)
    expect(screen.getByText('No headers')).toBeInTheDocument()
  })

  it('does not render a table when headers is undefined', () => {
    const { container } = render(<HeadersTable title="Response Headers" />)
    expect(container.querySelector('table')).not.toBeInTheDocument()
  })

  it('filters out headers with a ":" prefix', () => {
    render(
      <HeadersTable
        title="Request Headers"
        headers={[
          { name: ':authority', value: 'api.example.com' },
          { name: ':method', value: 'POST' },
          { name: 'content-type', value: 'application/json' },
        ]}
      />
    )
    expect(screen.queryByText(':authority')).not.toBeInTheDocument()
    expect(screen.queryByText(':method')).not.toBeInTheDocument()
    expect(screen.getByText('content-type')).toBeInTheDocument()
  })

  it('shows "No headers" when all headers are filtered out', () => {
    render(
      <HeadersTable
        title="Request Headers"
        headers={[{ name: ':authority', value: 'api.example.com' }]}
      />
    )
    expect(screen.getByText('No headers')).toBeInTheDocument()
  })

  describe('copy all headers button', () => {
    it('renders the copy-all button when visible headers exist', () => {
      render(
        <HeadersTable
          title="Request Headers"
          headers={[{ name: 'content-type', value: 'application/json' }]}
        />
      )
      expect(screen.getByTitle('Copy all headers')).toBeInTheDocument()
    })

    it('does not render the copy-all button when there are no headers', () => {
      render(<HeadersTable title="Request Headers" />)
      expect(screen.queryByTitle('Copy all headers')).not.toBeInTheDocument()
    })

    it('does not render the copy-all button when all headers are filtered out', () => {
      render(
        <HeadersTable title="Request Headers" headers={[{ name: ':method', value: 'POST' }]} />
      )
      expect(screen.queryByTitle('Copy all headers')).not.toBeInTheDocument()
    })

    it('clicking copy-all writes all visible headers to clipboard', () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      render(
        <HeadersTable
          title="Request Headers"
          headers={[
            { name: 'content-type', value: 'application/json' },
            { name: 'authorization', value: 'Bearer token' },
          ]}
        />
      )

      fireEvent.click(screen.getByTitle('Copy all headers'))

      expect(writeText).toHaveBeenCalledWith(
        'content-type: application/json\nauthorization: Bearer token'
      )
    })

    it('copy-all excludes pseudo-headers', () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      render(
        <HeadersTable
          title="Request Headers"
          headers={[
            { name: ':method', value: 'POST' },
            { name: 'content-type', value: 'application/json' },
          ]}
        />
      )

      fireEvent.click(screen.getByTitle('Copy all headers'))

      expect(writeText).toHaveBeenCalledWith('content-type: application/json')
    })
  })

  describe('per-row copy button', () => {
    it('renders a copy button for each header row', () => {
      render(
        <HeadersTable
          title="Request Headers"
          headers={[
            { name: 'content-type', value: 'application/json' },
            { name: 'authorization', value: 'Bearer token' },
          ]}
        />
      )
      expect(screen.getAllByTitle('Copy header')).toHaveLength(2)
    })

    it('clicking a row copy button writes that header to clipboard', () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      render(
        <HeadersTable
          title="Request Headers"
          headers={[
            { name: 'content-type', value: 'application/json' },
            { name: 'authorization', value: 'Bearer token' },
          ]}
        />
      )

      fireEvent.click(screen.getAllByTitle('Copy header')[0])

      expect(writeText).toHaveBeenCalledWith('content-type: application/json')
    })

    it('clicking the second row copy button writes the correct header', () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      render(
        <HeadersTable
          title="Request Headers"
          headers={[
            { name: 'content-type', value: 'application/json' },
            { name: 'authorization', value: 'Bearer token' },
          ]}
        />
      )

      fireEvent.click(screen.getAllByTitle('Copy header')[1])

      expect(writeText).toHaveBeenCalledWith('authorization: Bearer token')
    })
  })
})
