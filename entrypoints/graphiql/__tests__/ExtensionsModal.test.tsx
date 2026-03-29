import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ExtensionsModal.css', () => ({}))

import ExtensionsModal from '../ExtensionsModal'

describe('ExtensionsModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders with initial value in textarea', () => {
    render(<ExtensionsModal value='{"key": "value"}' onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('{"key": "value"}')
  })

  it('saves valid JSON object and closes', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={onSave} onClose={onClose} />)

    await user.type(screen.getByRole('textbox'), '{{"foo": "bar"}')
    await user.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledWith('{"foo": "bar"}')
    expect(onClose).toHaveBeenCalled()
  })

  it('saves empty string to clear extensions', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value='{"old": true}' onSave={onSave} onClose={onClose} />)

    await user.clear(screen.getByRole('textbox'))
    await user.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledWith('')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error for invalid JSON', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={onSave} onClose={vi.fn()} />)

    await user.type(screen.getByRole('textbox'), 'not json')
    await user.click(screen.getByText('Save'))

    expect(screen.getByText('Extensions must be a JSON object')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error for JSON array', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={onSave} onClose={vi.fn()} />)

    // userEvent interprets [ as a special key, so use fireEvent.change
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '[1, 2, 3]' } })
    await user.click(screen.getByText('Save'))

    expect(screen.getByText('Extensions must be a JSON object')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error for JSON string', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={onSave} onClose={vi.fn()} />)

    await user.type(screen.getByRole('textbox'), '"hello"')
    await user.click(screen.getByText('Save'))

    expect(screen.getByText('Extensions must be a JSON object')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error for JSON number', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={onSave} onClose={vi.fn()} />)

    await user.type(screen.getByRole('textbox'), '42')
    await user.click(screen.getByText('Save'))

    expect(screen.getByText('Extensions must be a JSON object')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error for JSON null', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={onSave} onClose={vi.fn()} />)

    await user.type(screen.getByRole('textbox'), 'null')
    await user.click(screen.getByText('Save'))

    expect(screen.getByText('Extensions must be a JSON object')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('closes on Escape key', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={vi.fn()} onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on backdrop click', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when clicking modal content', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByText('Extensions'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Cancel button click', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on close button click', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByLabelText('Close'))

    expect(onClose).toHaveBeenCalled()
  })

  it('clears error after correcting input and saving', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ExtensionsModal value="" onSave={onSave} onClose={onClose} />)

    await user.type(screen.getByRole('textbox'), 'bad')
    await user.click(screen.getByText('Save'))
    expect(screen.getByText('Extensions must be a JSON object')).toBeInTheDocument()

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), '{{"valid": true}')
    await user.click(screen.getByText('Save'))

    expect(screen.queryByText('Extensions must be a JSON object')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith('{"valid": true}')
  })
})
