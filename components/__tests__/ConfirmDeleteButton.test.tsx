import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ConfirmDeleteButton.css', () => ({}))
vi.mock('~/styles/shared.css', () => ({}))

import ConfirmDeleteButton from '../ConfirmDeleteButton'

describe('ConfirmDeleteButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders × button initially', () => {
    render(<ConfirmDeleteButton onDelete={vi.fn()} />)
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('shows Confirm and Cancel on × click', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteButton onDelete={vi.fn()} />)
    await user.click(screen.getByTitle('Delete'))
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('does not call onDelete on × click', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<ConfirmDeleteButton onDelete={onDelete} />)
    await user.click(screen.getByTitle('Delete'))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('calls onDelete when Confirm is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<ConfirmDeleteButton onDelete={onDelete} />)
    await user.click(screen.getByTitle('Delete'))
    await user.click(screen.getByText('Confirm'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('resets to × button after Confirm', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteButton onDelete={vi.fn()} />)
    await user.click(screen.getByTitle('Delete'))
    await user.click(screen.getByText('Confirm'))
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('resets to × button on Cancel', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<ConfirmDeleteButton onDelete={onDelete} />)
    await user.click(screen.getByTitle('Delete'))
    await user.click(screen.getByText('Cancel'))
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })
})
