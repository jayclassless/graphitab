import { cleanup, render, screen, fireEvent, act } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { CopyButton } from '../CopyButton'

describe('CopyButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders with the given title', () => {
    render(<CopyButton text="hello" title="Copy value" />)
    expect(screen.getByTitle('Copy value')).toBeInTheDocument()
  })

  it('shows the copy icon by default', () => {
    render(<CopyButton text="hello" title="Copy value" />)
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument()
  })

  it('writes the text to clipboard when clicked', () => {
    render(<CopyButton text="hello world" title="Copy value" />)
    fireEvent.click(screen.getByTitle('Copy value'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world')
  })

  it('shows the check icon immediately after clicking', () => {
    render(<CopyButton text="hello" title="Copy value" />)
    fireEvent.click(screen.getByTitle('Copy value'))
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('copy-icon')).not.toBeInTheDocument()
  })

  it('reverts to the copy icon after 1500ms', () => {
    render(<CopyButton text="hello" title="Copy value" />)
    fireEvent.click(screen.getByTitle('Copy value'))
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument()
  })

  it('does not revert before 1500ms', () => {
    render(<CopyButton text="hello" title="Copy value" />)
    fireEvent.click(screen.getByTitle('Copy value'))
    act(() => vi.advanceTimersByTime(1499))
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
  })

  it('resets the timer if clicked again while showing check icon', () => {
    render(<CopyButton text="hello" title="Copy value" />)
    fireEvent.click(screen.getByTitle('Copy value'))
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.click(screen.getByTitle('Copy value'))
    act(() => vi.advanceTimersByTime(1000))
    // 1000ms after the second click — should still show check
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(500))
    // 1500ms after second click — should revert
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument()
  })

  it('applies the default gt-headers-copy-btn class', () => {
    render(<CopyButton text="hello" title="Copy value" />)
    expect(screen.getByTitle('Copy value')).toHaveClass('gt-headers-copy-btn')
  })

  it('applies a custom className when provided', () => {
    render(<CopyButton text="hello" title="Copy value" className="my-btn" />)
    expect(screen.getByTitle('Copy value')).toHaveClass('my-btn')
    expect(screen.getByTitle('Copy value')).not.toHaveClass('gt-headers-copy-btn')
  })

  it('does not throw when clipboard write rejects', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
    render(<CopyButton text="hello" title="Copy value" />)
    fireEvent.click(screen.getByTitle('Copy value'))
    // Allow microtasks to settle — the .catch(() => {}) swallows the error
    await Promise.resolve()
  })
})
