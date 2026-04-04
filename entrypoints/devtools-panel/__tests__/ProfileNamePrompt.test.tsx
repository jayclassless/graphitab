import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ProfileNamePrompt.css', () => ({}))
vi.mock('~/styles/shared.css', () => ({}))

import { ProfileNamePrompt } from '../ProfileNamePrompt'

describe('ProfileNamePrompt', () => {
  afterEach(cleanup)

  it('displays the URL', () => {
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('https://api.example.com/graphql')).toBeInTheDocument()
  })

  it('displays the heading and message', () => {
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Create Profile')).toBeInTheDocument()
    expect(screen.getByText('No profile matches this endpoint:')).toBeInTheDocument()
  })

  it('disables the confirm button when the input is empty', () => {
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByText('Create & Open')).toBeDisabled()
  })

  it('disables the confirm button when the input is only whitespace', async () => {
    const user = userEvent.setup()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    await user.type(screen.getByPlaceholderText('Profile name...'), '   ')
    expect(screen.getByText('Create & Open')).toBeDisabled()
  })

  it('enables the confirm button when a name is entered', async () => {
    const user = userEvent.setup()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    await user.type(screen.getByPlaceholderText('Profile name...'), 'My API')
    expect(screen.getByText('Create & Open')).toBeEnabled()
  })

  it('calls onConfirm with the trimmed name when the button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    await user.type(screen.getByPlaceholderText('Profile name...'), '  My API  ')
    await user.click(screen.getByText('Create & Open'))
    expect(onConfirm).toHaveBeenCalledWith('My API')
  })

  it('calls onConfirm with the trimmed name on Enter', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    await user.type(screen.getByPlaceholderText('Profile name...'), 'My API{Enter}')
    expect(onConfirm).toHaveBeenCalledWith('My API')
  })

  it('does not call onConfirm on Enter when name is empty', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    await user.type(screen.getByPlaceholderText('Profile name...'), '{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    // Click the backdrop (the outer div with gt-modal-backdrop class)
    await user.click(document.querySelector('.gt-modal-backdrop')!)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not call onCancel when the prompt card is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    await user.click(document.querySelector('.gt-profile-prompt')!)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('focuses the input on mount', () => {
    render(
      <ProfileNamePrompt
        url="https://api.example.com/graphql"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Profile name...')).toHaveFocus()
  })
})
