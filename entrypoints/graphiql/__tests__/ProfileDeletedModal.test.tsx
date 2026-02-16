import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

const mockRestore = vi.fn()

vi.mock('~/utils/profiles', () => ({
  restore: (...args: unknown[]) => mockRestore(...args),
}))

vi.mock('../ProfileDeletedModal.css', () => ({}))

import ProfileDeletedModal from '../ProfileDeletedModal'

const mockProfile = { id: 'test-id', name: 'Test API', url: 'https://test.com/graphql' }
const mockSavedQueries = [
  { id: 'q1', name: 'Query 1', query: '{ hero { name } }', createdAt: 1000 },
]

describe('ProfileDeletedModal', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRestore.mockResolvedValue(undefined)
  })

  it('displays the deleted profile name', () => {
    render(
      <ProfileDeletedModal
        profile={mockProfile}
        savedQueries={mockSavedQueries}
        onRestored={vi.fn()}
      />
    )
    expect(screen.getByText('Test API')).toBeInTheDocument()
    expect(screen.getByText(/has been deleted/)).toBeInTheDocument()
  })

  it('calls restore and onRestored when Restore is clicked', async () => {
    const onRestored = vi.fn()
    const user = userEvent.setup()
    render(
      <ProfileDeletedModal
        profile={mockProfile}
        savedQueries={mockSavedQueries}
        onRestored={onRestored}
      />
    )
    await user.click(screen.getByText('Restore'))
    expect(mockRestore).toHaveBeenCalledWith(mockProfile, mockSavedQueries)
    expect(onRestored).toHaveBeenCalled()
  })

  it('calls window.close when Close Tab is clicked', async () => {
    const windowClose = vi.spyOn(window, 'close').mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <ProfileDeletedModal
        profile={mockProfile}
        savedQueries={mockSavedQueries}
        onRestored={vi.fn()}
      />
    )
    await user.click(screen.getByText('Close Tab'))
    expect(windowClose).toHaveBeenCalled()
    windowClose.mockRestore()
  })
})
