import './OpTypeBadge.css'
import type { OperationType } from './har'

type Props = {
  type: OperationType
}

export function OpTypeBadge({ type }: Props) {
  const label =
    type === 'mutation' ? 'M' : type === 'subscription' ? 'S' : type === 'batch' ? 'B' : 'Q'
  return <span className={`gt-op-badge gt-op-badge--${type}`}>{label}</span>
}
