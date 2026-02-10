import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ConfirmDeleteButton.css', () => ({}))

import ConfirmDeleteButton from '../ConfirmDeleteButton'

describe('ConfirmDeleteButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders × button when not confirming', () => {
    render(<ConfirmDeleteButton isConfirming={false} onDelete={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('calls onDelete when × button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<ConfirmDeleteButton isConfirming={false} onDelete={onDelete} onCancel={vi.fn()} />)
    await user.click(screen.getByTitle('Delete'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('renders Confirm and Cancel buttons when confirming', () => {
    render(<ConfirmDeleteButton isConfirming={true} onDelete={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('calls onDelete when Confirm is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<ConfirmDeleteButton isConfirming={true} onDelete={onDelete} onCancel={vi.fn()} />)
    await user.click(screen.getByText('Confirm'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmDeleteButton isConfirming={true} onDelete={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
