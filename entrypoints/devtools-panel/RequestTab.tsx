import ReactJsonView from '@microlink/react-json-view'
import { parse, print } from 'graphql'
import hljs from 'highlight.js/lib/core'
import graphql from 'highlight.js/lib/languages/graphql'
import { useMemo, useState } from 'react'

import './RequestTab.css'
import type { GraphQLRequest } from './har'

hljs.registerLanguage('graphql', graphql)

function formatQuery(raw: string): string {
  try {
    return print(parse(raw))
  } catch {
    return raw
  }
}

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

export function RequestTab({ request }: Props) {
  const isDark = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)').matches, [])
  const [showRaw, setShowRaw] = useState(false)

  const formattedQuery = useMemo(() => formatQuery(request.query), [request.query])
  const displayedQuery = showRaw ? request.query : formattedQuery

  const highlightedQuery = useMemo(
    () => hljs.highlight(formattedQuery, { language: 'graphql' }).value,
    [formattedQuery]
  )

  const parsedVariables = useMemo(
    () => (request.variables ? parseJsonObject(request.variables) : null),
    [request.variables]
  )

  const parsedExtensions = useMemo(
    () => (request.extensions ? parseJsonObject(request.extensions) : null),
    [request.extensions]
  )

  const jsonTheme = isDark ? 'monokai' : 'rjv-default'
  const jsonViewStyle = { background: 'transparent', padding: '0' }

  return (
    <div className="gt-request-tab">
      <section className="gt-request-section">
        <h3 className="gt-headers-section-title">
          Query
          <button
            className={`gt-raw-toggle${showRaw ? ' gt-raw-toggle--active' : ''}`}
            onClick={() => setShowRaw((v) => !v)}
          >
            Raw
          </button>
          <button
            className="gt-headers-copy-btn"
            title="Copy query"
            onClick={() => copyText(displayedQuery)}
          >
            <CopyIcon />
          </button>
        </h3>
        <pre className="gt-query-block">
          {showRaw ? (
            <code>{request.query}</code>
          ) : (
            <code dangerouslySetInnerHTML={{ __html: highlightedQuery }} />
          )}
        </pre>
      </section>

      {request.variables && (
        <section className="gt-request-section">
          <h3 className="gt-headers-section-title">
            Variables
            <button
              className="gt-headers-copy-btn"
              title="Copy variables"
              onClick={() => copyText(request.variables!)}
            >
              <CopyIcon />
            </button>
          </h3>
          {parsedVariables ? (
            <div className="gt-json-block">
              <ReactJsonView
                src={parsedVariables}
                name={null}
                displayDataTypes={false}
                enableClipboard={false}
                theme={jsonTheme}
                style={jsonViewStyle}
              />
            </div>
          ) : (
            <pre className="gt-query-block">
              <code>{request.variables}</code>
            </pre>
          )}
        </section>
      )}

      {request.extensions && (
        <section className="gt-request-section">
          <h3 className="gt-headers-section-title">
            Extensions
            <button
              className="gt-headers-copy-btn"
              title="Copy extensions"
              onClick={() => copyText(request.extensions!)}
            >
              <CopyIcon />
            </button>
          </h3>
          {parsedExtensions ? (
            <div className="gt-json-block">
              <ReactJsonView
                src={parsedExtensions}
                name={null}
                displayDataTypes={false}
                enableClipboard={false}
                theme={jsonTheme}
                style={jsonViewStyle}
              />
            </div>
          ) : (
            <pre className="gt-query-block">
              <code>{request.extensions}</code>
            </pre>
          )}
        </section>
      )}
    </div>
  )
}
