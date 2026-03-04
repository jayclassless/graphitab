import { filesize } from 'filesize'
import prettyMs from 'pretty-ms'
import { useEffect, useState } from 'react'

import './RequestModal.css'
import type { GraphQLRequest } from './har'
import { HeadersTable } from './HeadersTable'
import { RequestTab } from './RequestTab'
import { ResponseTab } from './ResponseTab'

type Tab = 'headers' | 'request' | 'response'

type Props = {
  request: GraphQLRequest
  onClose: () => void
}

const TABS: Tab[] = ['headers', 'request', 'response']

export function RequestModal({ request, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('headers')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
            <span className="gt-modal-title">{request.operationName}</span>
            <button className="gt-modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
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
          {activeTab === 'request' && <RequestTab request={request} />}
          {activeTab === 'response' && <ResponseTab request={request} />}
        </div>
      </div>
    </div>
  )
}
