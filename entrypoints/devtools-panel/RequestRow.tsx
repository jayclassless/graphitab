import { filesize } from 'filesize'
import prettyMs from 'pretty-ms'
import type { RowComponentProps } from 'react-window'

import type { GraphQLRequest, TableEntry } from './har'
import { isNavigationDivider } from './har'
import { OpTypeBadge } from './OpTypeBadge'

export const ROW_HEIGHT = 32

export type RowData = {
  visible: TableEntry[]
  onContextMenu: (req: GraphQLRequest, x: number, y: number) => void
  onClick: (req: GraphQLRequest) => void
}

export function RequestRow({
  index,
  style,
  ariaAttributes,
  visible,
  onContextMenu,
  onClick,
}: RowComponentProps<RowData>) {
  const entry = visible[index]

  if (isNavigationDivider(entry)) {
    return (
      <div style={style} className="gt-navigation-divider" {...ariaAttributes}>
        <div className="gt-navigation-divider-label" title={entry.url}>
          Navigated to <span className="gt-navigation-divider-url">{entry.url}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      style={style}
      className="gt-network-row"
      {...ariaAttributes}
      onClick={() => onClick(entry)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(entry, e.clientX, e.clientY)
      }}
    >
      <div title={entry.operationName}>
        <OpTypeBadge type={entry.operationType} persisted={entry.persisted} />
        {entry.operationName}
        {entry.batchedOperations && entry.batchedOperations.length > 1 && (
          <span className="gt-batch-extra-count">+{entry.batchedOperations.length - 1}</span>
        )}
      </div>
      <div>
        <span
          className={`gt-status-dot gt-status-dot--${entry.status < 400 ? 'success' : 'error'}`}
        />
        {entry.status}
      </div>
      <div>{filesize(entry.size)}</div>
      <div>{prettyMs(entry.time)}</div>
      <div title={entry.url}>{entry.url}</div>
    </div>
  )
}
