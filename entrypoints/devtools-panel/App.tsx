import { filesize } from 'filesize'
import prettyMs from 'pretty-ms'

import 'graphiql/style.css'
import './App.css'
import { useGraphQLRequests } from './useGraphQLRequests'

export default function App() {
  const requests = useGraphQLRequests()

  return (
    <div className="graphiql-container">
      <div className="gt-devtools-panel">
        <table className="gt-network-table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Status</th>
              <th>Size</th>
              <th>Time</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr className="gt-network-empty">
                <td colSpan={5}>No GraphQL requests recorded.</td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id}>
                  <td title={req.operationName}>
                    <span className={`gt-op-badge gt-op-badge--${req.operationType}`}>
                      {req.operationType === 'mutation'
                        ? 'M'
                        : req.operationType === 'subscription'
                          ? 'S'
                          : 'Q'}
                    </span>
                    {req.operationName}
                  </td>
                  <td>
                    <span
                      className={`gt-status-dot gt-status-dot--${req.status < 400 ? 'success' : 'error'}`}
                    />
                    {req.status}
                  </td>
                  <td>{filesize(req.size)}</td>
                  <td>{prettyMs(req.time)}</td>
                  <td title={req.url}>{req.url}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
