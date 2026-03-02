import { filesize } from 'filesize'
import prettyMs from 'pretty-ms'
import { useState } from 'react'

import 'graphiql/style.css'
import './App.css'
import type { OperationType } from './har'
import { useGraphQLRequests } from './useGraphQLRequests'

const FILTER_TYPES: OperationType[] = ['query', 'mutation']

export default function App() {
  const [preserveLog, setPreserveLog] = useState(false)
  const [activeTypes, setActiveTypes] = useState<Set<OperationType>>(new Set(FILTER_TYPES))

  const { requests, clear } = useGraphQLRequests(!preserveLog)

  function toggleType(type: OperationType) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const visible = requests.filter(
    (r) =>
      !FILTER_TYPES.includes(r.operationType as (typeof FILTER_TYPES)[number]) ||
      activeTypes.has(r.operationType)
  )

  return (
    <div className="graphiql-container">
      <div className="gt-devtools-panel">
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
        <table className="gt-network-table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Status</th>
              <th>Size</th>
              <th>Time</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr className="gt-network-empty">
                <td colSpan={5}>No GraphQL requests recorded.</td>
              </tr>
            ) : (
              visible.map((req) => (
                <tr key={req.id}>
                  <td title={req.operationName}>
                    <span className={`gt-op-badge gt-op-badge--${req.operationType}`}>
                      {req.operationType === 'mutation'
                        ? 'M'
                        : req.operationType === 'subscription'
                          ? 'S'
                          : 'Q'}
                    </span>
                    {req.operationName}
                  </td>
                  <td>
                    <span
                      className={`gt-status-dot gt-status-dot--${req.status < 400 ? 'success' : 'error'}`}
                    />
                    {req.status}
                  </td>
                  <td>{filesize(req.size)}</td>
                  <td>{prettyMs(req.time)}</td>
                  <td title={req.url}>{req.url}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
