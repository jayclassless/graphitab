import _ReactJsonView from '@microlink/react-json-view'
import type { ReactJsonViewProps } from '@microlink/react-json-view'
import type { ComponentType } from 'react'

const ReactJsonView = ((_ReactJsonView as any).default ??
  _ReactJsonView) as ComponentType<ReactJsonViewProps>
import { parse, print } from 'graphql'
import hljs from 'highlight.js/lib/core'
import graphql from 'highlight.js/lib/languages/graphql'
import { useMemo, useState } from 'react'

import './RequestTab.css'
import { CopyButton } from './CopyButton'
import { parseJsonObject } from './har'
import type { GraphQLRequest } from './har'
import { useDarkMode } from './useDarkMode'

hljs.registerLanguage('graphql', graphql)

function formatQuery(raw: string): string {
  try {
    return print(parse(raw))
  } catch {
    return raw
  }
}

type Props = {
  request: GraphQLRequest
}

export function RequestTab({ request }: Props) {
  const isDark = useDarkMode()
  const [showRaw, setShowRaw] = useState(false)
  const [showRawBody, setShowRawBody] = useState(false)

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

  const rawBodyToggle = request.rawBody ? (
    <button
      className={`gt-raw-toggle gt-raw-body-toggle${showRawBody ? ' gt-raw-toggle--active' : ''}`}
      title="Toggle between parsed and raw body view"
      onClick={() => setShowRawBody((v) => !v)}
    >
      {showRawBody ? 'Parsed Body' : 'Full Raw Body'}
    </button>
  ) : null

  return (
    <div className="gt-request-tab">
      {!showRawBody && (
        <>
          <section className="gt-request-section">
            <h3 className="gt-headers-section-title">
              Query
              <button
                className={`gt-raw-toggle${showRaw ? ' gt-raw-toggle--active' : ''}`}
                title="Display original, unformatted value"
                onClick={() => setShowRaw((v) => !v)}
              >
                Raw
              </button>
              <CopyButton text={displayedQuery} title="Copy query" />
              {rawBodyToggle}
            </h3>
            <pre className="gt-query-block">
              {showRaw ? (
                <code>{request.query}</code>
              ) : (
                <code dangerouslySetInnerHTML={{ __html: highlightedQuery }} />
              )}
            </pre>
          </section>

          {request.variables && !(parsedVariables && Object.keys(parsedVariables).length === 0) && (
            <section className="gt-request-section">
              <h3 className="gt-headers-section-title">
                Variables
                <CopyButton text={request.variables!} title="Copy variables" />
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

          {request.extensions &&
            !(parsedExtensions && Object.keys(parsedExtensions).length === 0) && (
              <section className="gt-request-section">
                <h3 className="gt-headers-section-title">
                  Extensions
                  <CopyButton text={request.extensions!} title="Copy extensions" />
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
        </>
      )}

      {showRawBody && (
        <section className="gt-request-section">
          <h3 className="gt-headers-section-title">
            Raw Body
            <CopyButton text={request.rawBody!} title="Copy raw body" />
            {rawBodyToggle}
          </h3>
          <pre className="gt-query-block">
            <code>{request.rawBody}</code>
          </pre>
        </section>
      )}
    </div>
  )
}
