import { useState } from 'react'

import { CopyButton } from './CopyButton'
import { extractJwt, isJwt } from './jwt'
import { JwtModal } from './JwtModal'

type Props = {
  title: string
  headers?: Array<{ name: string; value: string }>
}

export function HeadersTable({ title, headers }: Props) {
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const visible = headers?.filter(({ name }) => !name.startsWith(':'))
  return (
    <section className="gt-headers-section">
      <h3 className="gt-headers-section-title">
        {title}
        {visible && visible.length > 0 && (
          <CopyButton
            text={visible.map((h) => `${h.name}: ${h.value}`).join('\n')}
            title="Copy all headers"
          />
        )}
      </h3>
      {visible && visible.length > 0 ? (
        <table className="gt-headers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ name, value }, index) => (
              <tr key={index} className="gt-headers-row">
                <td>{name}</td>
                <td>
                  {isJwt(value) ? (
                    <button className="gt-jwt-link" onClick={() => setJwtToken(extractJwt(value))}>
                      {value}
                    </button>
                  ) : (
                    value
                  )}
                </td>
                <td className="gt-headers-row-actions">
                  <CopyButton text={`${name}: ${value}`} title="Copy header" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="gt-empty">No headers</p>
      )}
      {jwtToken && <JwtModal token={jwtToken} onClose={() => setJwtToken(null)} />}
    </section>
  )
}
