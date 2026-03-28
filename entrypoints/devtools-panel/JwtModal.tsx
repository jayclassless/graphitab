import { jwtDecode } from 'jwt-decode'
import { useEffect, useMemo } from 'react'

import { CopyButton } from './CopyButton'
import { JWT_CLAIM_DESCRIPTIONS } from './jwt'

import './JwtModal.css'

type Props = {
  token: string
  onClose: () => void
}

function ClaimsTable({ claims }: { claims: Record<string, unknown> }) {
  const entries = Object.entries(claims)
  return (
    <table className="gt-jwt-claims-table">
      <thead>
        <tr>
          <th>Claim</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => {
          const description = JWT_CLAIM_DESCRIPTIONS[key]
          return (
            <tr key={key}>
              <td
                className={description ? 'gt-jwt-claim-name--known' : undefined}
                title={description}
              >
                {key}
              </td>
              <td>{typeof value === 'string' ? value : JSON.stringify(value)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function JwtModal({ token, onClose }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [onClose])

  const decoded = useMemo(() => {
    try {
      const header = jwtDecode(token, { header: true }) as Record<string, unknown>
      const payload = jwtDecode(token) as Record<string, unknown>
      return { header, payload }
    } catch {
      return null
    }
  }, [token])

  return (
    <div className="gt-jwt-modal-backdrop" onClick={onClose}>
      <div
        className="gt-jwt-modal"
        role="dialog"
        aria-modal="true"
        aria-label="JWT Claims"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gt-jwt-modal-header">
          <span className="gt-jwt-modal-title">JWT Claims</span>
          <button className="gt-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="gt-jwt-modal-content">
          {decoded ? (
            <>
              <section className="gt-jwt-section">
                <h3 className="gt-jwt-section-title">
                  Header
                  <CopyButton
                    text={JSON.stringify(decoded.header, null, 2)}
                    title="Copy header JSON"
                  />
                </h3>
                <ClaimsTable claims={decoded.header} />
              </section>
              <section className="gt-jwt-section">
                <h3 className="gt-jwt-section-title">
                  Payload
                  <CopyButton
                    text={JSON.stringify(decoded.payload, null, 2)}
                    title="Copy payload JSON"
                  />
                </h3>
                <ClaimsTable claims={decoded.payload} />
              </section>
            </>
          ) : (
            <p className="gt-jwt-error">Failed to decode JWT</p>
          )}
        </div>
      </div>
    </div>
  )
}
