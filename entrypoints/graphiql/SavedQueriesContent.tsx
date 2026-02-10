import {
  useOperationsEditorState,
  useVariablesEditorState,
  useHeadersEditorState,
  useOptimisticState,
} from '@graphiql/react'
import { useState, useEffect, useCallback, useMemo } from 'react'

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

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [queryName, setQueryName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

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

  const loadQueries = useCallback(async () => {
    const queries = await storage.getAll()
    setSavedQueries(queries)
    setIsLoading(false)
  }, [storage])

  useEffect(() => {
    loadQueries()
  }, [loadQueries])

  const handleSave = async () => {
    const name = queryName.trim()
    if (!name || !operationsString) return

    await storage.create(name, operationsString, variablesString, headersString)

    setQueryName('')
    await loadQueries()
  }

  const handleLoad = (saved: SavedQuery) => {
    handleEditOperations(saved.query)
    handleEditVariables(saved.variables || '')
    handleEditHeaders(saved.headers || '')
  }

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    await storage.remove(id)
    await loadQueries()
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

      <div className="saved-queries-list">
        {savedQueries.length === 0 ? (
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
              <ConfirmDeleteButton
                isConfirming={confirmDeleteId === saved.id}
                onDelete={() => handleDelete(saved.id)}
                onCancel={() => setConfirmDeleteId(null)}
              />
            </div>
          ))
        )}
      </div>

      {savedQueries.length > 0 && (
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
