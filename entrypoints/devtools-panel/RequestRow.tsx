import { filesize } from 'filesize'
import prettyMs from 'pretty-ms'
import type { RowComponentProps } from 'react-window'

import type { GraphQLRequest } from './har'
import { OpTypeBadge } from './OpTypeBadge'

export const ROW_HEIGHT = 32

export type RowData = {
  visible: GraphQLRequest[]
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
  const req = visible[index]
  return (
    <div
      style={style}
      className="gt-network-row"
      {...ariaAttributes}
      onClick={() => onClick(req)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(req, e.clientX, e.clientY)
      }}
    >
      <div title={req.operationName}>
        <OpTypeBadge type={req.operationType} persisted={req.persisted} />
        {req.operationName}
        {req.batchedOperations && req.batchedOperations.length > 1 && (
          <span className="gt-batch-extra-count">+{req.batchedOperations.length - 1}</span>
        )}
      </div>
      <div>
        <span
          className={`gt-status-dot gt-status-dot--${req.status < 400 ? 'success' : 'error'}`}
        />
        {req.status}
      </div>
      <div>{filesize(req.size)}</div>
      <div>{prettyMs(req.time)}</div>
      <div title={req.url}>{req.url}</div>
    </div>
  )
}
