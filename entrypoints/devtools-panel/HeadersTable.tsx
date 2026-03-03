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
          <button
            className="gt-headers-copy-btn"
            title="Copy all headers"
            onClick={() => copyText(visible.map((h) => `${h.name}: ${h.value}`).join('\n'))}
          >
            <CopyIcon />
          </button>
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
                  <button
                    className="gt-headers-copy-btn"
                    title="Copy header"
                    onClick={() => copyText(`${name}: ${value}`)}
                  >
                    <CopyIcon />
                  </button>
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
