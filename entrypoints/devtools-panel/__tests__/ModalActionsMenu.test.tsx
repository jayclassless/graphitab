import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ModalActionsMenu.css', () => ({}))

import type { GraphQLRequest } from '../har'
import { ModalActionsMenu } from '../ModalActionsMenu'

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
    response: '{"data":{"hero":{"name":"Luke"}}}',
    ...overrides,
  }
}

function renderMenu(
  req: GraphQLRequest,
  onClose = vi.fn(),
  onOpenInGraphiQL?: (request: GraphQLRequest) => void
) {
  return render(
    <ModalActionsMenu request={req} onClose={onClose} onOpenInGraphiQL={onOpenInGraphiQL} />
  )
}

describe('ModalActionsMenu', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  describe('item visibility', () => {
    it('always shows Copy URL and Copy as cURL', () => {
      renderMenu(makeRequest())
      expect(screen.getByText('Copy URL')).toBeInTheDocument()
      expect(screen.getByText('Copy as cURL')).toBeInTheDocument()
    })

    it('shows Copy Request Body for POST requests', () => {
      renderMenu(makeRequest({ method: 'POST' }))
      expect(screen.getByText('Copy Request Body')).toBeInTheDocument()
    })

    it('hides Copy Request Body for GET requests without rawBody', () => {
      renderMenu(makeRequest({ method: 'GET', rawBody: undefined }))
      expect(screen.queryByText('Copy Request Body')).not.toBeInTheDocument()
    })

    it('shows Copy Request Body for GET requests when rawBody is present', () => {
      renderMenu(makeRequest({ method: 'GET', rawBody: '{"query":"{ hero }"}' }))
      expect(screen.getByText('Copy Request Body')).toBeInTheDocument()
    })

    it('shows Copy Response Body when response is present', () => {
      renderMenu(makeRequest({ response: '{"data":{}}' }))
      expect(screen.getByText('Copy Response Body')).toBeInTheDocument()
    })

    it('hides Copy Response Body when response is undefined', () => {
      renderMenu(makeRequest({ response: undefined }))
      expect(screen.queryByText('Copy Response Body')).not.toBeInTheDocument()
    })

    it('hides Copy Response Body when response is empty string', () => {
      renderMenu(makeRequest({ response: '' }))
      expect(screen.queryByText('Copy Response Body')).not.toBeInTheDocument()
    })
  })

  describe('copy actions', () => {
    it('Copy URL copies the URL and calls onClose', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest(), onClose)
      fireEvent.click(screen.getByText('Copy URL'))
      expect(writeText).toHaveBeenCalledWith('https://api.example.com/graphql')
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy Request Body copies constructed JSON for POST without rawBody', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest({ variables: undefined, extensions: undefined }), onClose)
      fireEvent.click(screen.getByText('Copy Request Body'))
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify({ query: 'query GetHero { hero { name } }' }, null, 2)
      )
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy Request Body copies rawBody when present', async () => {
      const onClose = vi.fn()
      const rawBody = '[{"query":"{ hero }"}]'
      renderMenu(makeRequest({ rawBody }), onClose)
      fireEvent.click(screen.getByText('Copy Request Body'))
      expect(writeText).toHaveBeenCalledWith(rawBody)
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy Request Body includes parsed variables in the constructed body', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest({ variables: '{"id":"1"}' }), onClose)
      fireEvent.click(screen.getByText('Copy Request Body'))
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify(
          { query: 'query GetHero { hero { name } }', variables: { id: '1' } },
          null,
          2
        )
      )
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy Request Body includes parsed extensions in the constructed body', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest({ extensions: '{"persistedQuery":{"version":1}}' }), onClose)
      fireEvent.click(screen.getByText('Copy Request Body'))
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify(
          {
            query: 'query GetHero { hero { name } }',
            extensions: { persistedQuery: { version: 1 } },
          },
          null,
          2
        )
      )
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy Request Body omits unparseable extensions from the constructed body', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest({ extensions: 'not-json' }), onClose)
      fireEvent.click(screen.getByText('Copy Request Body'))
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify({ query: 'query GetHero { hero { name } }' }, null, 2)
      )
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy Request Body omits unparseable variables from the constructed body', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest({ variables: 'not-json' }), onClose)
      fireEvent.click(screen.getByText('Copy Request Body'))
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify({ query: 'query GetHero { hero { name } }' }, null, 2)
      )
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy Response Body copies the response and calls onClose', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest(), onClose)
      fireEvent.click(screen.getByText('Copy Response Body'))
      expect(writeText).toHaveBeenCalledWith('{"data":{"hero":{"name":"Luke"}}}')
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('Copy as cURL copies a curl command and calls onClose', async () => {
      const onClose = vi.fn()
      renderMenu(makeRequest(), onClose)
      fireEvent.click(screen.getByText('Copy as cURL'))
      expect(writeText).toHaveBeenCalledOnce()
      expect(writeText.mock.calls[0][0]).toMatch(/^curl -X /)
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })

    it('calls onClose even when clipboard write rejects', async () => {
      writeText.mockRejectedValue(new Error('clipboard unavailable'))
      const onClose = vi.fn()
      renderMenu(makeRequest(), onClose)
      fireEvent.click(screen.getByText('Copy URL'))
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    })
  })

  describe('dismiss behavior', () => {
    it('pressing Escape calls onClose', () => {
      const onClose = vi.fn()
      renderMenu(makeRequest(), onClose)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('pressing a non-Escape key does not call onClose', () => {
      const onClose = vi.fn()
      renderMenu(makeRequest(), onClose)
      fireEvent.keyDown(document, { key: 'Enter' })
      expect(onClose).not.toHaveBeenCalled()
    })

    it('left-clicking outside the menu calls onClose', () => {
      const onClose = vi.fn()
      renderMenu(makeRequest(), onClose)
      fireEvent.mouseDown(document.body, { button: 0 })
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('left-clicking inside the menu does not call onClose', () => {
      const onClose = vi.fn()
      const { container } = renderMenu(makeRequest(), onClose)
      const menu = container.querySelector('.gt-modal-actions-menu') as HTMLElement
      fireEvent.mouseDown(menu, { button: 0 })
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Open in GraphiQL', () => {
    it('is hidden when onOpenInGraphiQL is not provided', () => {
      renderMenu(makeRequest())
      expect(screen.queryByText('Open in GraphiQL')).not.toBeInTheDocument()
    })

    it('is shown for a normal query when onOpenInGraphiQL is provided', () => {
      renderMenu(makeRequest(), vi.fn(), vi.fn())
      expect(screen.getByText('Open in GraphiQL')).toBeInTheDocument()
    })

    it('is hidden for batch requests', () => {
      renderMenu(
        makeRequest({
          operationType: 'batch',
          batchedOperations: [{ operationName: 'A', operationType: 'query', query: '{ a }' }],
        }),
        vi.fn(),
        vi.fn()
      )
      expect(screen.queryByText('Open in GraphiQL')).not.toBeInTheDocument()
    })

    it('is hidden for APQ requests without a query', () => {
      renderMenu(makeRequest({ persisted: true, query: '' }), vi.fn(), vi.fn())
      expect(screen.queryByText('Open in GraphiQL')).not.toBeInTheDocument()
    })

    it('is shown for APQ requests that include a query', () => {
      renderMenu(makeRequest({ persisted: true }), vi.fn(), vi.fn())
      expect(screen.getByText('Open in GraphiQL')).toBeInTheDocument()
    })

    it('calls onOpenInGraphiQL and onClose when clicked', () => {
      const onClose = vi.fn()
      const onOpenInGraphiQL = vi.fn()
      const request = makeRequest()
      renderMenu(request, onClose, onOpenInGraphiQL)
      fireEvent.click(screen.getByText('Open in GraphiQL'))
      expect(onOpenInGraphiQL).toHaveBeenCalledWith(request)
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
