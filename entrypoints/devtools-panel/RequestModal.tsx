import { filesize } from 'filesize'
import prettyMs from 'pretty-ms'
import { useEffect, useState } from 'react'

import './RequestModal.css'
import type { GraphQLRequest } from './har'
import { HeadersTable } from './HeadersTable'
import { ModalActionsMenu } from './ModalActionsMenu'
import { OpTypeBadge } from './OpTypeBadge'
import { RequestTab } from './RequestTab'
import { ResponseTab } from './ResponseTab'

type Tab = 'headers' | 'request' | 'response'

type Props = {
  request: GraphQLRequest
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

const TABS: Tab[] = ['headers', 'request', 'response']

export function RequestModal({ request, onClose, onPrev, onNext }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('headers')
  const [selectedOpIndex, setSelectedOpIndex] = useState(0)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)

  useEffect(() => {
    setSelectedOpIndex(0)
  }, [request])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrev, onNext])

  return (
    <div className="gt-modal-backdrop" onClick={onClose}>
      <div
        className="gt-modal"
        role="dialog"
        aria-modal="true"
        aria-label={request.operationName}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gt-modal-header">
          <div className="gt-modal-header-top">
            {request.batchedOperations ? (
              <div className="gt-modal-batch-nav">
                <OpTypeBadge
                  type={request.batchedOperations[selectedOpIndex].operationType}
                  persisted={request.batchedOperations[selectedOpIndex].persisted}
                />
                <select
                  className="gt-modal-title-select"
                  value={selectedOpIndex}
                  onChange={(e) => setSelectedOpIndex(Number(e.target.value))}
                  aria-label="Select operation"
                >
                  {request.batchedOperations.map((op, i) => (
                    <option key={i} value={i}>
                      {op.operationName}
                    </option>
                  ))}
                </select>
                <button
                  className="gt-modal-batch-nav-btn"
                  onClick={() => setSelectedOpIndex((i) => i - 1)}
                  disabled={selectedOpIndex === 0}
                  aria-label="Previous operation"
                >
                  ‹
                </button>
                <button
                  className="gt-modal-batch-nav-btn"
                  onClick={() => setSelectedOpIndex((i) => i + 1)}
                  disabled={selectedOpIndex === request.batchedOperations.length - 1}
                  aria-label="Next operation"
                >
                  ›
                </button>
              </div>
            ) : (
              <span className="gt-modal-title">
                <OpTypeBadge type={request.operationType} persisted={request.persisted} />
                {request.operationName}
              </span>
            )}
            <div className="gt-modal-header-actions">
              <button
                className="gt-modal-nav-btn"
                onClick={onPrev}
                disabled={!onPrev}
                aria-label="Previous request"
              >
                ‹
              </button>
              <button
                className="gt-modal-nav-btn"
                onClick={onNext}
                disabled={!onNext}
                aria-label="Next request"
              >
                ›
              </button>
              <div className="gt-modal-actions-anchor">
                <button
                  className="gt-modal-nav-btn"
                  onClick={() => setActionsMenuOpen((o) => !o)}
                  aria-label="More actions"
                  aria-haspopup="menu"
                  aria-expanded={actionsMenuOpen}
                >
                  ⋮
                </button>
                {actionsMenuOpen && (
                  <ModalActionsMenu request={request} onClose={() => setActionsMenuOpen(false)} />
                )}
              </div>
              <button className="gt-modal-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
          </div>
          <div className="gt-modal-meta">
            <span className="gt-modal-meta-method">{request.method}</span>
            <span className="gt-modal-meta-url">{request.url}</span>
            <span
              className={`gt-status-dot gt-status-dot--${request.status < 400 ? 'success' : 'error'}`}
            />
            <span>{request.status}</span>
            <span className="gt-modal-meta-sep">·</span>
            <span>{filesize(request.size)}</span>
            <span className="gt-modal-meta-sep">·</span>
            <span>{prettyMs(request.time)}</span>
          </div>
        </div>
        <div className="gt-modal-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`gt-modal-tab${activeTab === tab ? ' gt-modal-tab--active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="gt-modal-content" role="tabpanel">
          {activeTab === 'headers' && (
            <div className="gt-modal-headers">
              <HeadersTable title="Request Headers" headers={request.headers} />
              <HeadersTable title="Response Headers" headers={request.responseHeaders} />
            </div>
          )}
          {(() => {
            const selectedOp = request.batchedOperations?.[selectedOpIndex]
            const requestForTabs: GraphQLRequest = selectedOp
              ? {
                  ...request,
                  query: selectedOp.query,
                  variables: selectedOp.variables,
                  extensions: selectedOp.extensions,
                  response: selectedOp.response,
                  rawBody: undefined,
                  batchedOperations: undefined,
                }
              : request
            return (
              <>
                {activeTab === 'request' && <RequestTab request={requestForTabs} />}
                {activeTab === 'response' && <ResponseTab request={requestForTabs} />}
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
