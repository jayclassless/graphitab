import { useRef, useState, type CSSProperties } from 'react'
import { List } from 'react-window'

import {
  buildInitialState,
  findProfileByUrl,
  stripGraphQLParams,
  storeInitialState,
  openGraphiQLTab,
  type GraphiQLInitialState,
} from '~/utils/open_in_graphiql'
import { getAll as getAllProfiles, create as createProfile } from '~/utils/profiles'

import 'graphiql/style.css'
import './App.css'
import { ContextMenu } from './ContextMenu'
import type { GraphQLRequest } from './har'
import { isNavigationDivider } from './har'
import { ProfileNamePrompt } from './ProfileNamePrompt'
import { RequestModal } from './RequestModal'
import { RequestRow, ROW_HEIGHT, type RowData } from './RequestRow'
import { useDevtoolsSettings, FILTER_TYPES } from './useDevtoolsSettings'
import { useGraphQLRequests } from './useGraphQLRequests'

const MIN_COL_WIDTH = 40

export default function App() {
  const { preserveLog, setPreserveLog, activeTypes, toggleType, columnWidths, setColumnWidths } =
    useDevtoolsSettings()
  const { entries, clear } = useGraphQLRequests(!preserveLog)

  const visible = entries.filter(
    (entry) =>
      isNavigationDivider(entry) ||
      !FILTER_TYPES.includes(entry.operationType as (typeof FILTER_TYPES)[number]) ||
      activeTypes.has(entry.operationType)
  )

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    request: GraphQLRequest
  } | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<GraphQLRequest | null>(null)
  const [profilePrompt, setProfilePrompt] = useState<{
    url: string
    state: GraphiQLInitialState
  } | null>(null)

  async function handleOpenInGraphiQL(request: GraphQLRequest) {
    const state = buildInitialState(request)
    const allProfiles = await getAllProfiles()
    const match = findProfileByUrl(allProfiles, request.url)
    if (match) {
      await storeInitialState(match.id, state)
      await openGraphiQLTab(match.id)
    } else {
      setProfilePrompt({ url: stripGraphQLParams(request.url), state })
    }
  }

  async function handleProfilePromptConfirm(name: string) {
    if (!profilePrompt) return
    const { url, state } = profilePrompt
    const newProfile = await createProfile(name, url)
    setProfilePrompt(null)
    await storeInitialState(newProfile.id, state)
    await openGraphiQLTab(newProfile.id)
  }

  const dragState = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null)

  function startResize(colIndex: number, e: React.MouseEvent) {
    e.preventDefault()
    dragState.current = { colIndex, startX: e.clientX, startWidth: columnWidths[colIndex] }

    function onMouseMove(ev: MouseEvent) {
      if (!dragState.current) return
      const { colIndex: idx, startX, startWidth } = dragState.current
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + (ev.clientX - startX))
      setColumnWidths(columnWidths.map((w, i) => (i === idx ? newWidth : w)))
    }

    function onMouseUp() {
      dragState.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const gridTemplateColumns = [...columnWidths.map((w) => `${w}px`), '1fr'].join(' ')

  return (
    <div className="graphiql-container">
      <div
        className="gt-devtools-panel"
        style={{ '--gt-col-widths': gridTemplateColumns } as CSSProperties}
      >
        <div className="gt-devtools-toolbar">
          <div className="gt-devtools-toolbar-controls">
            <button
              className="gt-clear-btn"
              onClick={clear}
              aria-label="Clear network log"
              title="Clear network log"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                <line
                  x1="3.5"
                  y1="10.5"
                  x2="10.5"
                  y2="3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <label
              className="gt-toolbar-label"
              title="Do not clear log on page reload / navigation"
            >
              <input
                type="checkbox"
                checked={preserveLog}
                onChange={(e) => setPreserveLog(e.target.checked)}
              />
              Preserve log
            </label>
          </div>
          <div className="gt-type-filter">
            {FILTER_TYPES.map((type) => (
              <button
                key={type}
                className={`gt-btn gt-type-filter-btn${activeTypes.has(type) ? ' gt-type-filter-btn--active' : ''}`}
                onClick={() => toggleType(type)}
                aria-pressed={activeTypes.has(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="gt-network-header">
          <div>
            Operation
            <div
              className="gt-col-resize-handle"
              onMouseDown={(e) => startResize(0, e)}
              aria-hidden="true"
            />
          </div>
          <div>
            Status
            <div
              className="gt-col-resize-handle"
              onMouseDown={(e) => startResize(1, e)}
              aria-hidden="true"
            />
          </div>
          <div>
            Size
            <div
              className="gt-col-resize-handle"
              onMouseDown={(e) => startResize(2, e)}
              aria-hidden="true"
            />
          </div>
          <div>
            Time
            <div
              className="gt-col-resize-handle"
              onMouseDown={(e) => startResize(3, e)}
              aria-hidden="true"
            />
          </div>
          <div>URL</div>
        </div>
        <div className="gt-network-body">
          {visible.length === 0 ? (
            <div className="gt-network-empty">No GraphQL requests recorded.</div>
          ) : (
            <List<RowData>
              rowComponent={RequestRow}
              rowCount={visible.length}
              rowHeight={ROW_HEIGHT}
              rowProps={{
                visible,
                onContextMenu: (req, x, y) => setContextMenu({ x, y, request: req }),
                onClick: (req) => setSelectedRequest(req),
              }}
              style={{ height: '100%' }}
            />
          )}
        </div>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          request={contextMenu.request}
          onClose={() => setContextMenu(null)}
          onOpenInGraphiQL={handleOpenInGraphiQL}
        />
      )}
      {selectedRequest &&
        (() => {
          const selectedIndex = visible.findIndex((r) => r.id === selectedRequest.id)
          const prevIndex = (() => {
            for (let i = selectedIndex - 1; i >= 0; i--) {
              if (!isNavigationDivider(visible[i])) return i
            }
            return -1
          })()
          const nextIndex = (() => {
            for (let i = selectedIndex + 1; i < visible.length; i++) {
              if (!isNavigationDivider(visible[i])) return i
            }
            return -1
          })()
          return (
            <RequestModal
              request={selectedRequest}
              onClose={() => setSelectedRequest(null)}
              onOpenInGraphiQL={handleOpenInGraphiQL}
              onPrev={
                prevIndex >= 0
                  ? () => setSelectedRequest(visible[prevIndex] as GraphQLRequest)
                  : undefined
              }
              onNext={
                nextIndex >= 0
                  ? () => setSelectedRequest(visible[nextIndex] as GraphQLRequest)
                  : undefined
              }
            />
          )
        })()}
      {profilePrompt && (
        <ProfileNamePrompt
          url={profilePrompt.url}
          onConfirm={handleProfilePromptConfirm}
          onCancel={() => setProfilePrompt(null)}
        />
      )}
    </div>
  )
}
