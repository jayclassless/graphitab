import ReactJsonView from '@microlink/react-json-view'
import { useMemo, useState } from 'react'

import './ResponseTab.css'
import type { GraphQLRequest } from './har'

function parseJsonObject(str: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(str)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

const CopyIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
)

type Props = {
  request: GraphQLRequest
}

export function ResponseTab({ request }: Props) {
  const isDark = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)').matches, [])
  const [showRaw, setShowRaw] = useState(false)

  const parsedResponse = useMemo(
    () => (request.response ? parseJsonObject(request.response) : null),
    [request.response]
  )

  const prettifiedResponse = useMemo(
    () => (parsedResponse ? JSON.stringify(parsedResponse, null, 2) : null),
    [parsedResponse]
  )

  const jsonTheme = isDark ? 'monokai' : 'rjv-default'
  const jsonViewStyle = { background: 'transparent', padding: '0' }

  if (!request.response) {
    return (
      <div className="gt-response-tab">
        <p className="gt-empty">No response body</p>
      </div>
    )
  }

  return (
    <div className="gt-response-tab">
      <section className="gt-request-section">
        <h3 className="gt-headers-section-title">
          Body
          <button
            className={`gt-raw-toggle${showRaw ? ' gt-raw-toggle--active' : ''}`}
            onClick={() => setShowRaw((v) => !v)}
          >
            Raw
          </button>
          <button
            className="gt-headers-copy-btn"
            title="Copy response"
            onClick={() =>
              copyText(!showRaw && prettifiedResponse ? prettifiedResponse : request.response!)
            }
          >
            <CopyIcon />
          </button>
        </h3>
        {showRaw || !parsedResponse ? (
          <pre className="gt-query-block">
            <code>{request.response}</code>
          </pre>
        ) : (
          <div className="gt-json-block">
            <ReactJsonView
              src={parsedResponse}
              name={null}
              displayDataTypes={false}
              enableClipboard={false}
              theme={jsonTheme}
              style={jsonViewStyle}
            />
          </div>
        )}
      </section>
    </div>
  )
}
