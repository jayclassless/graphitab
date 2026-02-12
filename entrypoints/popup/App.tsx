import { useState, useEffect, useMemo } from 'react'
import { browser } from 'wxt/browser'

import ConfirmDeleteButton from '~/components/ConfirmDeleteButton'
import * as profiles from '~/utils/profiles'
import '~/styles/shared.css'
import './App.css'
import 'graphiql/style.css'

const GRAPHIQL_PATH = '/graphiql.html'

type FormMode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; profileId: string }

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
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'closed' })
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

  const loadProfiles = async () => {
    try {
      const all = await profiles.getAll()
      setAllProfiles(all)
    } catch {
      setError('Failed to load profiles')
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const resetForm = () => {
    setName('')
    setUrl('')
    setFormMode({ kind: 'closed' })
  }

  const handleDelete = async (id: string) => {
    setError(null)

    try {
      const params = new URLSearchParams({ profile: id }).toString()
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

  const handleEdit = (profile: profiles.Profile) => {
    setName(profile.name)
    setUrl(profile.url)
    setFormMode({ kind: 'edit', profileId: profile.id })
  }

  const handleUpdate = async () => {
    if (!canSubmit || formMode.kind !== 'edit') return
    setError(null)

    try {
      await profiles.update(formMode.profileId, trimmedName, trimmedUrl)
      resetForm()
    } catch {
      setError('Failed to update profile')
    }
    loadProfiles()
  }

  const handleSubmit = () => {
    if (formMode.kind === 'edit') {
      handleUpdate()
    } else {
      handleCreate()
    }
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
            const params = new URLSearchParams({ profile: profile.id }).toString()
            return (
              <div key={profile.id} className="popup-profile-item">
                <a className="gt-list-item" href={`${GRAPHIQL_PATH}?${params}`} target="_blank">
                  {profile.name}
                </a>
                <button
                  className="popup-edit-btn"
                  onClick={() => handleEdit(profile)}
                  title="Edit"
                  aria-label="Edit"
                >
                  ✎
                </button>
                <ConfirmDeleteButton onDelete={() => handleDelete(profile.id)} />
              </div>
            )
          })
        )}
      </div>
      {formMode.kind !== 'closed' ? (
        <div className="popup-form">
          <input
            className="gt-input"
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
          />
          <input
            className={`gt-input${urlInvalid ? ' popup-input-invalid' : ''}`}
            type="url"
            placeholder="GraphQL endpoint URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
          />
          <div className="popup-form-actions">
            <button
              className="gt-btn popup-btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {formMode.kind === 'edit' ? 'Save' : 'Add'}
            </button>
            <button className="gt-btn" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="gt-btn popup-btn-add" onClick={() => setFormMode({ kind: 'create' })}>
          + New Profile
        </button>
      )}
    </div>
  )
}
