import qs from 'qs'
import { useState, useEffect, useMemo } from 'react'
import { browser } from 'wxt/browser'

import ConfirmDeleteButton from '~/components/ConfirmDeleteButton'
import * as profiles from '~/utils/profiles'
import '~/styles/shared.css'
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
  const [error, setError] = useState<string | null>(null)

  const sortedProfiles = useMemo(
    () => [...allProfiles].sort((a, b) => a.name.localeCompare(b.name)),
    [allProfiles]
  )

  const trimmedName = name.trim()
  const trimmedUrl = url.trim()
  const urlInvalid = !!trimmedUrl && !isValidUrl(trimmedUrl)
  const canSubmit = !!trimmedName && !urlInvalid && !!trimmedUrl

  const loadProfiles = () => {
    profiles
      .getAll()
      .then(setAllProfiles)
      .catch(() => {
        setError('Failed to load profiles')
      })
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
    setError(null)

    try {
      const params = qs.stringify({ profile: id })
      const matchUrl = `${browser.runtime.getURL(GRAPHIQL_PATH)}?${params}`
      const tabs = await browser.tabs.query({ url: matchUrl })
      if (tabs.length > 0) {
        await browser.tabs.remove(tabs.map((t) => t.id!))
      }

      await profiles.remove(id)
    } catch {
      setError('Failed to delete profile')
    }
    loadProfiles()
  }

  const handleCreate = async () => {
    if (!canSubmit) return
    setError(null)

    try {
      await profiles.create(trimmedName, trimmedUrl)
      resetForm()
    } catch {
      setError('Failed to create profile')
    }
    loadProfiles()
  }

  return (
    <div className="popup graphiql-container">
      <div className="popup-title">GraphiTab</div>
      {error && <div className="popup-error">{error}</div>}
      <div className="popup-list">
        {sortedProfiles.length === 0 ? (
          <div className="gt-empty">No profiles configured</div>
        ) : (
          sortedProfiles.map((profile) => {
            const params = qs.stringify({ profile: profile.id })
            return (
              <div key={profile.id} className="popup-profile-item">
                <a className="gt-list-item" href={`${GRAPHIQL_PATH}?${params}`} target="_blank">
                  {profile.name}
                </a>
                <ConfirmDeleteButton onDelete={() => handleDelete(profile.id)} />
              </div>
            )
          })
        )}
      </div>
      {showForm ? (
        <div className="popup-form">
          <input
            className="gt-input"
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={`gt-input${urlInvalid ? ' popup-input-invalid' : ''}`}
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
              className="gt-btn popup-btn-primary"
              onClick={handleCreate}
              disabled={!canSubmit}
            >
              Add
            </button>
            <button className="gt-btn" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="gt-btn popup-btn-add" onClick={() => setShowForm(true)}>
          + New Profile
        </button>
      )}
    </div>
  )
}
