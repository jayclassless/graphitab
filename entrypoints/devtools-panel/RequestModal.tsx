import { useEffect, useState } from 'react'

import './RequestModal.css'
import type { GraphQLRequest } from './har'

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
          <span className="gt-modal-title">{request.operationName}</span>
          <button className="gt-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
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
        <div className="gt-modal-content" role="tabpanel" />
      </div>
    </div>
  )
}
