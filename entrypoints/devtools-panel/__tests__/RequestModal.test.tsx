import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../RequestModal.css', () => ({}))

import type { GraphQLRequest } from '../har'
import { RequestModal } from '../RequestModal'

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

function renderModal(req: GraphQLRequest = makeRequest(), onClose = vi.fn()) {
  return render(<RequestModal request={req} onClose={onClose} />)
}

describe('RequestModal', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders with role="dialog" and aria-modal="true"', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('displays the operation name in the header', () => {
    renderModal(makeRequest({ operationName: 'MyQuery' }))
    expect(screen.getByText('MyQuery')).toBeInTheDocument()
  })

  it('renders all three tabs', () => {
    renderModal()
    expect(screen.getByRole('tab', { name: 'Headers' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Request' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Response' })).toBeInTheDocument()
  })

  it('Headers tab is active by default', () => {
    renderModal()
    expect(screen.getByRole('tab', { name: 'Headers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Response' })).toHaveAttribute('aria-selected', 'false')
  })

  it('clicking Request tab makes it active', () => {
    renderModal()
    fireEvent.click(screen.getByRole('tab', { name: 'Request' }))
    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Headers' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Response' })).toHaveAttribute('aria-selected', 'false')
  })

  it('clicking Response tab makes it active', () => {
    renderModal()
    fireEvent.click(screen.getByRole('tab', { name: 'Response' }))
    expect(screen.getByRole('tab', { name: 'Response' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Headers' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute('aria-selected', 'false')
  })

  it('pressing Escape calls onClose', () => {
    const onClose = vi.fn()
    renderModal(makeRequest(), onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = renderModal(makeRequest(), onClose)
    const backdrop = container.querySelector('.gt-modal-backdrop') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking the × button calls onClose', () => {
    const onClose = vi.fn()
    renderModal(makeRequest(), onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking inside the modal does not call onClose', () => {
    const onClose = vi.fn()
    const { container } = renderModal(makeRequest(), onClose)
    const modal = container.querySelector('.gt-modal') as HTMLElement
    fireEvent.click(modal)
    expect(onClose).not.toHaveBeenCalled()
  })
})
