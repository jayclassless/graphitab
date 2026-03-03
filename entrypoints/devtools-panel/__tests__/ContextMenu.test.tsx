import { cleanup, render, screen, fireEvent } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../ContextMenu.css', () => ({}))

import { ContextMenu } from '../ContextMenu'
import type { GraphQLRequest } from '../har'

function makeRequest(overrides: Partial<GraphQLRequest> = {}): GraphQLRequest {
  return {
    id: '1',
    operationName: 'GetHero',
    operationType: 'query',
    status: 200,
    size: 512,
    time: 123,
    url: 'https://api.example.com/graphql',
    query: 'query GetHero { hero { name } }',
    variables: '{\n  "id": "1"\n}',
    response: '{"data":{"hero":{"name":"Luke"}}}',
    ...overrides,
  }
}

function renderMenu(req: GraphQLRequest, onClose = vi.fn()) {
  return render(<ContextMenu x={100} y={200} request={req} onClose={onClose} />)
}

describe('ContextMenu', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('always shows Copy URL, Copy Query, Copy Variables, Copy Response when all fields present', () => {
    renderMenu(makeRequest())
    expect(screen.getByText('Copy URL')).toBeInTheDocument()
    expect(screen.getByText('Copy Query')).toBeInTheDocument()
    expect(screen.getByText('Copy Variables')).toBeInTheDocument()
    expect(screen.getByText('Copy Response')).toBeInTheDocument()
  })

  it('hides Copy Variables when variables is undefined', () => {
    renderMenu(makeRequest({ variables: undefined }))
    expect(screen.queryByText('Copy Variables')).not.toBeInTheDocument()
  })

  it('hides Copy Response when response is undefined', () => {
    renderMenu(makeRequest({ response: undefined }))
    expect(screen.queryByText('Copy Response')).not.toBeInTheDocument()
  })

  it('hides Copy Response when response is empty string', () => {
    renderMenu(makeRequest({ response: '' }))
    expect(screen.queryByText('Copy Response')).not.toBeInTheDocument()
  })

  it('Copy URL copies the url and calls onClose', async () => {
    const onClose = vi.fn()
    renderMenu(makeRequest(), onClose)
    fireEvent.click(screen.getByText('Copy URL'))
    expect(writeText).toHaveBeenCalledWith('https://api.example.com/graphql')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('Copy Query copies the query string and calls onClose', async () => {
    const onClose = vi.fn()
    renderMenu(makeRequest(), onClose)
    fireEvent.click(screen.getByText('Copy Query'))
    expect(writeText).toHaveBeenCalledWith('query GetHero { hero { name } }')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('Copy Variables copies the pretty-printed variables and calls onClose', async () => {
    const onClose = vi.fn()
    renderMenu(makeRequest({ variables: '{"id":"1"}' }), onClose)
    fireEvent.click(screen.getByText('Copy Variables'))
    expect(writeText).toHaveBeenCalledWith('{\n  "id": "1"\n}')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('Copy Response copies the pretty-printed response and calls onClose', async () => {
    const onClose = vi.fn()
    renderMenu(makeRequest(), onClose)
    fireEvent.click(screen.getByText('Copy Response'))
    expect(writeText).toHaveBeenCalledWith(
      '{\n  "data": {\n    "hero": {\n      "name": "Luke"\n    }\n  }\n}'
    )
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('pressing Escape calls onClose', () => {
    const onClose = vi.fn()
    renderMenu(makeRequest(), onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('left-clicking outside the menu calls onClose', () => {
    const onClose = vi.fn()
    renderMenu(makeRequest(), onClose)
    fireEvent.mouseDown(document.body, { button: 0 })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('right-clicking outside the menu does not call onClose', () => {
    const onClose = vi.fn()
    renderMenu(makeRequest(), onClose)
    fireEvent.mouseDown(document.body, { button: 2 })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('left-clicking inside the menu does not call onClose', () => {
    const onClose = vi.fn()
    const { container } = renderMenu(makeRequest(), onClose)
    const menu = container.querySelector('.gt-context-menu') as HTMLElement
    fireEvent.mouseDown(menu, { button: 0 })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('menu is positioned at the given x/y coordinates', () => {
    const { container } = renderMenu(makeRequest())
    const menu = container.querySelector('.gt-context-menu') as HTMLElement
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('200px')
  })

  it('copies non-JSON variables as-is when pretty-printing fails', async () => {
    const onClose = vi.fn()
    renderMenu(makeRequest({ variables: 'not json' }), onClose)
    fireEvent.click(screen.getByText('Copy Variables'))
    expect(writeText).toHaveBeenCalledWith('not json')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('copies non-JSON response as-is when pretty-printing fails', async () => {
    const onClose = vi.fn()
    renderMenu(makeRequest({ response: 'plain text response' }), onClose)
    fireEvent.click(screen.getByText('Copy Response'))
    expect(writeText).toHaveBeenCalledWith('plain text response')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('calls onClose even when clipboard write rejects', async () => {
    writeText.mockRejectedValue(new Error('clipboard unavailable'))
    const onClose = vi.fn()
    renderMenu(makeRequest(), onClose)
    fireEvent.click(screen.getByText('Copy Query'))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('contextmenu event on the document is prevented while the menu is open', () => {
    renderMenu(makeRequest())
    const prevented = fireEvent.contextMenu(document.body)
    expect(prevented).toBe(false)
  })
})
