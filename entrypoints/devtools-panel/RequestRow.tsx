import { filesize } from 'filesize'
import prettyMs from 'pretty-ms'
import type { RowComponentProps } from 'react-window'

import type { GraphQLRequest } from './har'

export const ROW_HEIGHT = 32

export type RowData = { visible: GraphQLRequest[] }

export function RequestRow({ index, style, ariaAttributes, visible }: RowComponentProps<RowData>) {
  const req = visible[index]
  return (
    <div style={style} className="gt-network-row" {...ariaAttributes}>
      <div title={req.operationName}>
        <span className={`gt-op-badge gt-op-badge--${req.operationType}`}>
          {req.operationType === 'mutation'
            ? 'M'
            : req.operationType === 'subscription'
              ? 'S'
              : 'Q'}
        </span>
        {req.operationName}
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
