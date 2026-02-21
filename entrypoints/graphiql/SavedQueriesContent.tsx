import {
  useOperationsEditorState,
  useVariablesEditorState,
  useHeadersEditorState,
  useOptimisticState,
  useGraphiQLActions,
} from '@graphiql/react'
import { useState, useEffect, useMemo } from 'react'

import ConfirmDeleteButton from '~/components/ConfirmDeleteButton'
import { SavedQuery, SavedQueriesStorage } from '~/utils/queries_storage'

import '~/styles/shared.css'
import './SavedQueriesContent.css'

type SortField = 'name' | 'createdAt'
type SortDirection = 'asc' | 'desc'

export default function SavedQueriesContent({ storage }: { storage: SavedQueriesStorage }) {
  const [operationsString, handleEditOperations] = useOptimisticState(useOperationsEditorState())
  const [variablesString, handleEditVariables] = useOptimisticState(useVariablesEditorState())
  const [headersString, handleEditHeaders] = useOptimisticState(useHeadersEditorState())
  const { addTab } = useGraphiQLActions()

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [queryName, setQueryName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [error, setError] = useState<string | null>(null)

  const sortedQueries = useMemo(() => {
    return [...savedQueries].sort((a, b) => {
      let cmp: number
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else {
        cmp = a.createdAt - b.createdAt
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [savedQueries, sortField, sortDirection])

  useEffect(() => {
    storage
      .getAll()
      .then(setSavedQueries)
      .catch(() => setError('Failed to load saved queries'))
      .finally(() => setIsLoading(false))
  }, [storage])

  useEffect(() => {
    return storage.watch((queries) => {
      setSavedQueries(queries)
    })
  }, [storage])

  const handleSave = async () => {
    const name = queryName.trim()
    if (!name || !operationsString) return
    setError(null)

    try {
      await storage.create(name, operationsString, variablesString, headersString)
      setQueryName('')
    } catch {
      setError('Failed to save query')
    }
  }

  const handleLoad = (saved: SavedQuery) => {
    handleEditOperations(saved.query)
    handleEditVariables(saved.variables || '')
    handleEditHeaders(saved.headers || '')
  }

  const handleOpenInNewTab = (saved: SavedQuery) => {
    addTab()
    setTimeout(() => {
      handleEditOperations(saved.query)
      handleEditVariables(saved.variables || '')
      handleEditHeaders(saved.headers || '')
    }, 0)
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await storage.remove(id)
    } catch {
      setError('Failed to delete query')
    }
  }

  if (isLoading) {
    return <div className="saved-queries-loading">Loading...</div>
  }

  return (
    <div className="saved-queries-plugin">
      <div className="saved-queries-save-section">
        <input
          type="text"
          placeholder="Query name..."
          value={queryName}
          onChange={(e) => setQueryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
          }}
          className="gt-input"
        />
        <button
          onClick={handleSave}
          disabled={!queryName.trim() || !operationsString}
          className="gt-btn"
        >
          Save
        </button>
      </div>

      {error && <div className="saved-queries-error">{error}</div>}
      <div className="saved-queries-list">
        {sortedQueries.length === 0 ? (
          <div className="gt-empty">No saved queries yet</div>
        ) : (
          sortedQueries.map((saved) => (
            <div key={saved.id} className="saved-queries-item">
              <button
                className="gt-list-item"
                onClick={() => handleLoad(saved)}
                title={saved.query}
              >
                {saved.name}
              </button>
              <button
                className="saved-queries-open-tab"
                onClick={() => handleOpenInNewTab(saved)}
                title="Open in new tab"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
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
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
              </button>
              <ConfirmDeleteButton onDelete={() => handleDelete(saved.id)} />
            </div>
          ))
        )}
      </div>

      {sortedQueries.length > 0 && (
        <div className="saved-queries-sort-section">
          <select
            className="saved-queries-sort-select"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="name">Sort by Name</option>
            <option value="createdAt">Sort by Saved Date</option>
          </select>
          <button
            className="gt-btn saved-queries-sort-direction"
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            aria-label={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>
      )}
    </div>
  )
}
