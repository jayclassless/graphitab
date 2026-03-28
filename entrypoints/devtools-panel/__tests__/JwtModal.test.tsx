// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

const mockHeader = { alg: 'HS256', typ: 'JWT' }
const mockPayload = { sub: '1234567890', name: 'John Doe', iss: 'auth.example.com', custom: true }

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn((_token: string, opts?: { header: boolean }) => {
    if (opts?.header) return mockHeader
    return mockPayload
  }),
}))

import { JwtModal } from '../JwtModal'

describe('JwtModal', () => {
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dummysig'

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the modal title', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    expect(screen.getByText('JWT Claims')).toBeInTheDocument()
  })

  it('renders header claims in a table', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('alg')).toBeInTheDocument()
    expect(screen.getByText('HS256')).toBeInTheDocument()
    expect(screen.getByText('typ')).toBeInTheDocument()
    expect(screen.getByText('JWT')).toBeInTheDocument()
  })

  it('renders payload claims in a table', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    expect(screen.getByText('Payload')).toBeInTheDocument()
    expect(screen.getByText('sub')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders non-string values as JSON', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('shows a title tooltip for known claims', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    const issCell = screen.getByText('iss')
    expect(issCell).toHaveAttribute('title', 'Issuer')
    const subCell = screen.getByText('sub')
    expect(subCell).toHaveAttribute('title', 'Subject')
  })

  it('does not add a title attribute for unknown claims', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    const customCell = screen.getByText('custom')
    expect(customCell).not.toHaveAttribute('title')
  })

  it('adds the known class to recognized claims', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    const issCell = screen.getByText('iss')
    expect(issCell).toHaveClass('gt-jwt-claim-name--known')
  })

  it('does not add the known class to unrecognized claims', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    const customCell = screen.getByText('custom')
    expect(customCell).not.toHaveClass('gt-jwt-claim-name--known')
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<JwtModal token={token} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose when modal body is clicked', () => {
    const onClose = vi.fn()
    render(<JwtModal token={token} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<JwtModal token={token} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('stops Escape propagation to prevent parent modal from closing', () => {
    const onClose = vi.fn()
    const parentHandler = vi.fn()
    document.addEventListener('keydown', parentHandler)

    render(<JwtModal token={token} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
    expect(parentHandler).not.toHaveBeenCalled()

    document.removeEventListener('keydown', parentHandler)
  })

  it('renders copy buttons for header and payload JSON', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    expect(screen.getByTitle('Copy header JSON')).toBeInTheDocument()
    expect(screen.getByTitle('Copy payload JSON')).toBeInTheDocument()
  })

  it('copy header button writes correct JSON to clipboard', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Copy header JSON'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(mockHeader, null, 2))
  })

  it('copy payload button writes correct JSON to clipboard', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Copy payload JSON'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(mockPayload, null, 2))
  })

  it('shows an error message when decoding fails', async () => {
    const { jwtDecode } = vi.mocked(await import('jwt-decode'))
    jwtDecode.mockImplementationOnce(() => {
      throw new Error('Invalid token')
    })

    render(<JwtModal token="invalid" onClose={vi.fn()} />)
    expect(screen.getByText('Failed to decode JWT')).toBeInTheDocument()
  })

  it('renders the close button', () => {
    render(<JwtModal token={token} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<JwtModal token={token} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
