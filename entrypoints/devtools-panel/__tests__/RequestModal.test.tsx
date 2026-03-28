import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../RequestModal.css', () => ({}))
vi.mock('../ModalActionsMenu', () => ({
  ModalActionsMenu: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="modal-actions-menu" role="menu">
      <button onClick={onClose}>Close menu</button>
    </div>
  ),
}))
vi.mock('../RequestTab', () => ({
  RequestTab: ({ request }: { request: { query: string } }) => (
    <div data-testid="request-tab-mock" data-query={request.query} />
  ),
}))
vi.mock('../ResponseTab', () => ({
  ResponseTab: ({ request }: { request: { response?: string } }) => (
    <div data-testid="response-tab-mock" data-response={request.response} />
  ),
}))

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
    responseHeaders: [{ name: 'x-request-id', value: 'abc123' }],
    ...overrides,
  }
}

function renderModal(req: GraphQLRequest = makeRequest(), onClose = vi.fn()) {
  return render(<RequestModal request={req} onClose={onClose} />)
}

function renderWithNav(
  req = makeRequest(),
  props: { onPrev?: () => void; onNext?: () => void } = {}
) {
  return render(<RequestModal request={req} onClose={vi.fn()} {...props} />)
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

  it('shows persisted indicator on badge for APQ requests', () => {
    renderModal(makeRequest({ persisted: true }))
    expect(screen.getByText('Q')).toHaveClass('gt-op-badge--persisted')
  })

  it('does not show persisted indicator on badge for non-APQ requests', () => {
    renderModal(makeRequest())
    expect(screen.getByText('Q')).not.toHaveClass('gt-op-badge--persisted')
  })

  describe('metadata bar', () => {
    it('displays the HTTP method', () => {
      renderModal(makeRequest({ method: 'POST' }))
      expect(screen.getByText('POST')).toBeInTheDocument()
    })

    it('displays the URL', () => {
      renderModal(makeRequest({ url: 'https://api.example.com/graphql' }))
      expect(screen.getByText('https://api.example.com/graphql')).toBeInTheDocument()
    })

    it('displays the status code', () => {
      renderModal(makeRequest({ status: 200 }))
      expect(screen.getByText('200')).toBeInTheDocument()
    })

    it('displays the formatted size', () => {
      renderModal(makeRequest({ size: 512 }))
      expect(screen.getByText('512 B')).toBeInTheDocument()
    })

    it('displays the formatted time', () => {
      renderModal(makeRequest({ time: 123 }))
      expect(screen.getByText('123ms')).toBeInTheDocument()
    })
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

  it('pressing a non-Escape key does not call onClose', () => {
    const onClose = vi.fn()
    renderModal(makeRequest(), onClose)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
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

  describe('Headers tab content', () => {
    it('Headers tab renders Request Headers and Response Headers sections', () => {
      renderModal()
      expect(screen.getByText('Request Headers')).toBeInTheDocument()
      expect(screen.getByText('Response Headers')).toBeInTheDocument()
    })

    it('Headers tab content is not visible when a different tab is active', () => {
      renderModal()
      fireEvent.click(screen.getByRole('tab', { name: 'Request' }))
      expect(screen.queryByText('Request Headers')).not.toBeInTheDocument()
      expect(screen.queryByText('Response Headers')).not.toBeInTheDocument()
    })
  })

  describe('Request tab content', () => {
    it('Request tab renders RequestTab component when active', () => {
      renderModal()
      fireEvent.click(screen.getByRole('tab', { name: 'Request' }))
      expect(screen.getByTestId('request-tab-mock')).toBeInTheDocument()
    })

    it('RequestTab is not in DOM when a different tab is active', () => {
      renderModal()
      expect(screen.queryByTestId('request-tab-mock')).not.toBeInTheDocument()
    })
  })

  describe('Response tab content', () => {
    it('Response tab renders ResponseTab component when active', () => {
      renderModal()
      fireEvent.click(screen.getByRole('tab', { name: 'Response' }))
      expect(screen.getByTestId('response-tab-mock')).toBeInTheDocument()
    })

    it('ResponseTab is not in DOM when a different tab is active', () => {
      renderModal()
      expect(screen.queryByTestId('response-tab-mock')).not.toBeInTheDocument()
    })
  })

  describe('Batch operation dropdown', () => {
    function makeBatchRequest(overrides: Partial<GraphQLRequest> = {}): GraphQLRequest {
      return makeRequest({
        operationType: 'batch',
        operationName: 'GetHero',
        batchedOperations: [
          {
            operationName: 'GetHero',
            operationType: 'query',
            query: 'query GetHero { hero { name } }',
            response: '{"data":{"hero":{"name":"Luke"}}}',
          },
          {
            operationName: 'GetVillain',
            operationType: 'query',
            query: 'query GetVillain { villain { name } }',
            response: '{"data":{"villain":{"name":"Vader"}}}',
          },
        ],
        ...overrides,
      })
    }

    it('does not render a dropdown for non-batch requests', () => {
      renderModal()
      expect(screen.queryByRole('combobox', { name: 'Select operation' })).not.toBeInTheDocument()
    })

    it('renders a dropdown for batch requests with all operation names as options', () => {
      renderModal(makeBatchRequest())
      const select = screen.getByRole('combobox', { name: 'Select operation' })
      expect(select).toBeInTheDocument()
      const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
      expect(options).toEqual(['GetHero', 'GetVillain'])
    })

    it('default selected option is the first operation', () => {
      renderModal(makeBatchRequest())
      const select = screen.getByRole('combobox', { name: 'Select operation' }) as HTMLSelectElement
      expect(select.value).toBe('0')
    })

    it('changing dropdown selection updates the Request tab query', () => {
      renderModal(makeBatchRequest())
      fireEvent.click(screen.getByRole('tab', { name: 'Request' }))
      expect(screen.getByTestId('request-tab-mock')).toHaveAttribute(
        'data-query',
        'query GetHero { hero { name } }'
      )
      fireEvent.change(screen.getByRole('combobox', { name: 'Select operation' }), {
        target: { value: '1' },
      })
      expect(screen.getByTestId('request-tab-mock')).toHaveAttribute(
        'data-query',
        'query GetVillain { villain { name } }'
      )
    })

    it('changing dropdown selection updates the Response tab content', () => {
      renderModal(makeBatchRequest())
      fireEvent.click(screen.getByRole('tab', { name: 'Response' }))
      expect(screen.getByTestId('response-tab-mock')).toHaveAttribute(
        'data-response',
        '{"data":{"hero":{"name":"Luke"}}}'
      )
      fireEvent.change(screen.getByRole('combobox', { name: 'Select operation' }), {
        target: { value: '1' },
      })
      expect(screen.getByTestId('response-tab-mock')).toHaveAttribute(
        'data-response',
        '{"data":{"villain":{"name":"Vader"}}}'
      )
    })

    it('Headers tab content is unaffected by dropdown selection', () => {
      renderModal(makeBatchRequest())
      expect(screen.getByText('Request Headers')).toBeInTheDocument()
      fireEvent.change(screen.getByRole('combobox', { name: 'Select operation' }), {
        target: { value: '1' },
      })
      expect(screen.getByText('Request Headers')).toBeInTheDocument()
    })

    it('Previous button is disabled when first operation is selected', () => {
      renderModal(makeBatchRequest())
      expect(screen.getByRole('button', { name: 'Previous operation' })).toBeDisabled()
    })

    it('Next button is disabled when last operation is selected', () => {
      renderModal(makeBatchRequest())
      fireEvent.change(screen.getByRole('combobox', { name: 'Select operation' }), {
        target: { value: '1' },
      })
      expect(screen.getByRole('button', { name: 'Next operation' })).toBeDisabled()
    })

    it('Next button advances to the next operation', () => {
      renderModal(makeBatchRequest())
      fireEvent.click(screen.getByRole('button', { name: 'Next operation' }))
      const select = screen.getByRole('combobox', { name: 'Select operation' }) as HTMLSelectElement
      expect(select.value).toBe('1')
    })

    it('Previous button goes back to the previous operation', () => {
      renderModal(makeBatchRequest())
      fireEvent.change(screen.getByRole('combobox', { name: 'Select operation' }), {
        target: { value: '1' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Previous operation' }))
      const select = screen.getByRole('combobox', { name: 'Select operation' }) as HTMLSelectElement
      expect(select.value).toBe('0')
    })

    it('shows persisted indicator on badge for APQ batch operation', () => {
      renderModal(
        makeBatchRequest({
          batchedOperations: [
            {
              operationName: 'GetHero',
              operationType: 'query',
              query: 'query GetHero { hero { name } }',
              persisted: true,
            },
            {
              operationName: 'GetVillain',
              operationType: 'query',
              query: 'query GetVillain { villain { name } }',
            },
          ],
        })
      )
      expect(screen.getByText('Q')).toHaveClass('gt-op-badge--persisted')
    })

    it('resets to first operation when a new request is opened', () => {
      const { rerender } = renderModal(makeBatchRequest())
      fireEvent.change(screen.getByRole('combobox', { name: 'Select operation' }), {
        target: { value: '1' },
      })
      const select = screen.getByRole('combobox', { name: 'Select operation' }) as HTMLSelectElement
      expect(select.value).toBe('1')

      const newRequest = makeBatchRequest({ id: '2' })
      rerender(<RequestModal request={newRequest} onClose={vi.fn()} />)
      expect(
        (screen.getByRole('combobox', { name: 'Select operation' }) as HTMLSelectElement).value
      ).toBe('0')
    })
  })

  describe('navigation buttons', () => {
    it('renders Previous request and Next request buttons', () => {
      renderWithNav()
      expect(screen.getByRole('button', { name: 'Previous request' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next request' })).toBeInTheDocument()
    })

    it('Previous request button is disabled when onPrev is not provided', () => {
      renderWithNav()
      expect(screen.getByRole('button', { name: 'Previous request' })).toBeDisabled()
    })

    it('Next request button is disabled when onNext is not provided', () => {
      renderWithNav()
      expect(screen.getByRole('button', { name: 'Next request' })).toBeDisabled()
    })

    it('Previous request button is enabled when onPrev is provided', () => {
      renderWithNav(makeRequest(), { onPrev: vi.fn() })
      expect(screen.getByRole('button', { name: 'Previous request' })).toBeEnabled()
    })

    it('Next request button is enabled when onNext is provided', () => {
      renderWithNav(makeRequest(), { onNext: vi.fn() })
      expect(screen.getByRole('button', { name: 'Next request' })).toBeEnabled()
    })

    it('clicking Previous request button calls onPrev', () => {
      const onPrev = vi.fn()
      renderWithNav(makeRequest(), { onPrev })
      fireEvent.click(screen.getByRole('button', { name: 'Previous request' }))
      expect(onPrev).toHaveBeenCalledOnce()
    })

    it('clicking Next request button calls onNext', () => {
      const onNext = vi.fn()
      renderWithNav(makeRequest(), { onNext })
      fireEvent.click(screen.getByRole('button', { name: 'Next request' }))
      expect(onNext).toHaveBeenCalledOnce()
    })

    it('pressing ArrowLeft calls onPrev', () => {
      const onPrev = vi.fn()
      renderWithNav(makeRequest(), { onPrev })
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      expect(onPrev).toHaveBeenCalledOnce()
    })

    it('pressing ArrowRight calls onNext', () => {
      const onNext = vi.fn()
      renderWithNav(makeRequest(), { onNext })
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(onNext).toHaveBeenCalledOnce()
    })

    it('pressing ArrowLeft does nothing when onPrev is not provided', () => {
      renderWithNav()
      expect(() => fireEvent.keyDown(document, { key: 'ArrowLeft' })).not.toThrow()
    })

    it('pressing ArrowRight does nothing when onNext is not provided', () => {
      renderWithNav()
      expect(() => fireEvent.keyDown(document, { key: 'ArrowRight' })).not.toThrow()
    })
  })

  describe('actions menu', () => {
    it('renders the More actions button', () => {
      renderWithNav()
      expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument()
    })

    it('clicking More actions button opens the actions menu', () => {
      renderWithNav()
      expect(screen.queryByTestId('modal-actions-menu')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
      expect(screen.getByTestId('modal-actions-menu')).toBeInTheDocument()
    })

    it('actions menu is closed after its onClose callback is invoked', () => {
      renderWithNav()
      fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
      expect(screen.getByTestId('modal-actions-menu')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Close menu'))
      expect(screen.queryByTestId('modal-actions-menu')).not.toBeInTheDocument()
    })
  })
})
