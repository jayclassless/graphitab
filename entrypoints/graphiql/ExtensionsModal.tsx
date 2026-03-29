import { useState, useEffect } from 'react'

import './ExtensionsModal.css'

type ExtensionsModalProps = {
  value: string
  onSave: (value: string) => void
  onClose: () => void
}

function isJsonObject(value: string): boolean {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
  } catch {
    return false
  }
}

export default function ExtensionsModal({ value, onSave, onClose }: ExtensionsModalProps) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSave = () => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      setError(null)
      onSave('')
      onClose()
      return
    }

    if (!isJsonObject(trimmed)) {
      setError('Extensions must be a JSON object')
      return
    }

    setError(null)
    onSave(trimmed)
    onClose()
  }

  return (
    <div
      className="graphiql-container extensions-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="extensions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="extensions-modal-header">
          <h3>Extensions</h3>
          <button className="extensions-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <textarea
          className="extensions-modal-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='{"key": "value"}'
          spellCheck={false}
        />
        {error && <div className="extensions-modal-error">{error}</div>}
        <div className="extensions-modal-actions">
          <button className="gt-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="gt-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
