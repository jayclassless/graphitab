import ReactJsonView from '@microlink/react-json-view'
import { useMemo, useState } from 'react'

import './ResponseTab.css'
import { CopyButton } from './CopyButton'
import { parseJsonObject } from './har'
import type { GraphQLRequest } from './har'
import { useDarkMode } from './useDarkMode'

type Props = {
  request: GraphQLRequest
}

export function ResponseTab({ request }: Props) {
  const isDark = useDarkMode()
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
            title="Display original, unformatted value"
            onClick={() => setShowRaw((v) => !v)}
          >
            Raw
          </button>
          <CopyButton
            text={!showRaw && prettifiedResponse ? prettifiedResponse : request.response!}
            title="Copy response"
          />
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
