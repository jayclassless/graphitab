import { useEffect, useRef } from 'react'

import './ContextMenu.css'
import type { GraphQLRequest } from './har'

type Props = {
  x: number
  y: number
  request: GraphQLRequest
  onClose: () => void
}

function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function copyAndClose(text: string, onClose: () => void) {
  navigator.clipboard
    .writeText(text)
    .finally(onClose)
    .catch(() => {})
}

export function ContextMenu({ x, y, request, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleMouseDown(e: MouseEvent) {
      // Ignore right-clicks — they're handled by the contextmenu event
      if (e.button === 2) return
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    function handleContextMenu(e: MouseEvent) {
      // Prevent the browser's native menu while ours is open.
      // Right-clicking on a row fires that row's onContextMenu first,
      // which updates state to show the new row's menu.
      e.preventDefault()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [onClose])

  return (
    <div ref={menuRef} className="gt-context-menu" style={{ left: x, top: y }} role="menu">
      <button
        className="gt-context-menu-item"
        role="menuitem"
        onClick={() => copyAndClose(request.url, onClose)}
      >
        Copy URL
      </button>
      <button
        className="gt-context-menu-item"
        role="menuitem"
        onClick={() => copyAndClose(request.query, onClose)}
      >
        Copy Query
      </button>
      {request.variables !== undefined && (
        <button
          className="gt-context-menu-item"
          role="menuitem"
          onClick={() => copyAndClose(prettyJson(request.variables!), onClose)}
        >
          Copy Variables
        </button>
      )}
      {request.response && (
        <button
          className="gt-context-menu-item"
          role="menuitem"
          onClick={() => copyAndClose(prettyJson(request.response!), onClose)}
        >
          Copy Response
        </button>
      )}
    </div>
  )
}
