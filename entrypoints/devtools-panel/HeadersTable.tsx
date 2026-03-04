import { CopyButton } from './CopyButton'

type Props = {
  title: string
  headers?: Array<{ name: string; value: string }>
}

export function HeadersTable({ title, headers }: Props) {
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
            {visible.map(({ name, value }) => (
              <tr key={name} className="gt-headers-row">
                <td>{name}</td>
                <td>{value}</td>
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
    </section>
  )
}
