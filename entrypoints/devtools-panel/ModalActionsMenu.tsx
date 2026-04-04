import { useEffect, useRef } from 'react'

import { canOpenInGraphiQL } from '~/utils/open_in_graphiql'

import './ModalActionsMenu.css'
import { buildCurlCommand } from './har'
import type { GraphQLRequest } from './har'

type Props = {
  request: GraphQLRequest
  onClose: () => void
  onOpenInGraphiQL?: (request: GraphQLRequest) => void
}

function copyAndClose(text: string, onClose: () => void) {
  navigator.clipboard
    .writeText(text)
    .catch(() => {})
    .finally(onClose)
}

function requestBody(request: GraphQLRequest): string {
  if (request.rawBody) return request.rawBody
  const body: Record<string, unknown> = { query: request.query }
  if (request.variables) {
    try {
      body.variables = JSON.parse(request.variables)
    } catch {
      // omit unparseable variables
    }
  }
  if (request.extensions) {
    try {
      body.extensions = JSON.parse(request.extensions)
    } catch {
      // omit unparseable extensions
    }
  }
  return JSON.stringify(body, null, 2)
}

export function ModalActionsMenu({ request, onClose, onOpenInGraphiQL }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleMouseDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [onClose])

  const hasBody = request.rawBody !== undefined || request.method.toUpperCase() === 'POST'

  return (
    <div ref={menuRef} className="gt-modal-actions-menu" role="menu">
      <button
        className="gt-modal-actions-menu-item"
        role="menuitem"
        onClick={() => copyAndClose(request.url, onClose)}
      >
        Copy URL
      </button>
      {hasBody && (
        <button
          className="gt-modal-actions-menu-item"
          role="menuitem"
          onClick={() => copyAndClose(requestBody(request), onClose)}
        >
          Copy Request Body
        </button>
      )}
      {request.response && (
        <button
          className="gt-modal-actions-menu-item"
          role="menuitem"
          onClick={() => copyAndClose(request.response!, onClose)}
        >
          Copy Response Body
        </button>
      )}
      <button
        className="gt-modal-actions-menu-item"
        role="menuitem"
        onClick={() => copyAndClose(buildCurlCommand(request), onClose)}
      >
        Copy as cURL
      </button>
      {onOpenInGraphiQL && canOpenInGraphiQL(request) && (
        <>
          <button
            className="gt-modal-actions-menu-item"
            role="menuitem"
            onClick={() => {
              onOpenInGraphiQL(request)
              onClose()
            }}
          >
            Open in GraphiQL
          </button>
        </>
      )}
    </div>
  )
}
