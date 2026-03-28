import './OpTypeBadge.css'
import type { OperationType } from './har'

type Props = {
  type: OperationType
  persisted?: boolean
}

export function OpTypeBadge({ type, persisted }: Props) {
  const label =
    type === 'mutation' ? 'M' : type === 'subscription' ? 'S' : type === 'batch' ? 'B' : 'Q'
  return (
    <span
      className={`gt-op-badge gt-op-badge--${type}${persisted ? ' gt-op-badge--persisted' : ''}`}
    >
      {label}
    </span>
  )
}
