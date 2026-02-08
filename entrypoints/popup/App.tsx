import qs from 'qs'
import { useState, useEffect, useMemo } from 'react'

import * as profiles from '~/utils/profiles'

import './App.css'
import 'graphiql/style.css'

const GRAPHIQL_PATH = '/graphiql.html'

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export default function App() {
  const [allProfiles, setAllProfiles] = useState<profiles.Profile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const sortedProfiles = useMemo(
    () => [...allProfiles].sort((a, b) => a.name.localeCompare(b.name)),
    [allProfiles]
  )

  const trimmedName = name.trim()
  const trimmedUrl = url.trim()
  const urlInvalid = !!trimmedUrl && !isValidUrl(trimmedUrl)
  const canSubmit = !!trimmedName && !urlInvalid && !!trimmedUrl

  const loadProfiles = () => {
    profiles.getAll().then(setAllProfiles)
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const resetForm = () => {
    setName('')
    setUrl('')
    setShowForm(false)
  }

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    await profiles.remove(id)
    loadProfiles()
  }

  const handleCreate = async () => {
    if (!canSubmit) return

    await profiles.create(trimmedName, trimmedUrl)
    resetForm()
    loadProfiles()
  }

  return (
    <div className="popup graphiql-container">
      <div className="popup-title">GraphiTab</div>
      <div className="popup-list">
        {sortedProfiles.length === 0 ? (
          <div className="popup-empty">No profiles configured</div>
        ) : (
          sortedProfiles.map((profile) => {
            const params = qs.stringify({ profile: profile.id })
            return (
              <div key={profile.id} className="popup-profile-item">
                <a
                  className="popup-profile-link"
                  href={`${GRAPHIQL_PATH}?${params}`}
                  target="_blank"
                >
                  {profile.name}
                </a>
                {confirmDeleteId === profile.id ? (
                  <div className="popup-confirm-delete">
                    <button className="popup-confirm-btn" onClick={() => handleDelete(profile.id)}>
                      Confirm
                    </button>
                    <button className="popup-cancel-btn" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="popup-delete-btn"
                    onClick={() => handleDelete(profile.id)}
                    title="Delete"
                    aria-label="Delete"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
      {showForm ? (
        <div className="popup-form">
          <input
            className="popup-input"
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={`popup-input${urlInvalid ? ' popup-input-invalid' : ''}`}
            type="url"
            placeholder="GraphQL endpoint URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
          <div className="popup-form-actions">
            <button
              className="popup-btn popup-btn-primary"
              onClick={handleCreate}
              disabled={!canSubmit}
            >
              Add
            </button>
            <button className="popup-btn" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="popup-btn popup-btn-add" onClick={() => setShowForm(true)}>
          + New Profile
        </button>
      )}
    </div>
  )
}
