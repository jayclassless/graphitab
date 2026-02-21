import { useState, useEffect, useMemo, useRef } from 'react'
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
  const [headers, setHeaders] = useState<Array<{ id: number; key: string; value: string }>>([])
  const headerIdRef = useRef(0)
  const [error, setError] = useState<string | null>(null)

  const sortedProfiles = useMemo(
    () => [...allProfiles].sort((a, b) => a.name.localeCompare(b.name)),
    [allProfiles]
  )

  const trimmedName = name.trim()
  const trimmedUrl = url.trim()
  const urlInvalid = !!trimmedUrl && !isValidUrl(trimmedUrl)
  const nameDuplicate =
    !!trimmedName &&
    allProfiles.some(
      (p) =>
        p.name.toLowerCase() === trimmedName.toLowerCase() &&
        (formMode.kind !== 'edit' || p.id !== formMode.profileId)
    )
  const canSubmit = !!trimmedName && !urlInvalid && !!trimmedUrl && !nameDuplicate

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

  const headersToRecord = (): Record<string, string> | undefined => {
    const filtered = headers.filter((h) => h.key.trim() !== '')
    if (filtered.length === 0) return undefined
    return Object.fromEntries(filtered.map((h) => [h.key.trim(), h.value.trim()]))
  }

  const resetForm = () => {
    setName('')
    setUrl('')
    setHeaders([])
    setFormMode({ kind: 'closed' })
  }

  const handleDelete = async (id: string) => {
    setError(null)

    try {
      await profiles.remove(id)
      await loadProfiles()
    } catch {
      setError('Failed to delete profile')
    }
  }

  const handleCreate = async () => {
    if (!canSubmit) return
    setError(null)

    try {
      await profiles.create(trimmedName, trimmedUrl, headersToRecord())
      resetForm()
      await loadProfiles()
    } catch {
      setError('Failed to create profile')
    }
  }

  const handleEdit = (profile: profiles.Profile) => {
    setName(profile.name)
    setUrl(profile.url)
    setHeaders(
      profile.headers
        ? Object.entries(profile.headers).map(([key, value]) => ({
            id: ++headerIdRef.current,
            key,
            value,
          }))
        : []
    )
    setFormMode({ kind: 'edit', profileId: profile.id })
  }

  const handleUpdate = async () => {
    if (!canSubmit || formMode.kind !== 'edit') return
    setError(null)

    try {
      await profiles.update(formMode.profileId, trimmedName, trimmedUrl, headersToRecord())
      resetForm()
      await loadProfiles()
    } catch {
      setError('Failed to update profile')
    }
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
      <div className="popup-title">
        GraphiTab
        <a
          className="popup-title-icon"
          href={browser.runtime.getManifest().homepage_url}
          target="_blank"
          rel="noopener noreferrer"
          title="GraphiTab Homepage"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
      </div>
      {error && <div className="popup-error">{error}</div>}
      <div className="popup-list">
        {sortedProfiles.length === 0 ? (
          <div className="gt-empty">No profiles configured</div>
        ) : (
          sortedProfiles.map((profile) => {
            const params = new URLSearchParams({ profile: profile.id }).toString()
            return (
              <div key={profile.id} className="popup-profile-item">
                <a
                  className="gt-list-item"
                  href={`${GRAPHIQL_PATH}?${params}`}
                  onClick={async (e) => {
                    e.preventDefault()
                    const currentWindow = await browser.windows.getCurrent()
                    await browser.tabs.create({
                      url: browser.runtime.getURL(`${GRAPHIQL_PATH}?${params}`),
                      windowId: currentWindow.id,
                    })
                    window.close()
                  }}
                >
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
          {nameDuplicate && (
            <div className="popup-warning">A profile with this name already exists</div>
          )}
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
          <div className="popup-headers">
            {headers.map((header, index) => (
              <div key={header.id} className="popup-header-row">
                <input
                  className="gt-input popup-header-key"
                  type="text"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => {
                    const next = [...headers]
                    next[index] = { ...next[index], key: e.target.value }
                    setHeaders(next)
                  }}
                />
                <input
                  className="gt-input popup-header-value"
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => {
                    const next = [...headers]
                    next[index] = { ...next[index], value: e.target.value }
                    setHeaders(next)
                  }}
                />
                <button
                  className="popup-header-remove"
                  onClick={() => setHeaders(headers.filter((_, i) => i !== index))}
                  title="Remove header"
                  aria-label="Remove header"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              className="gt-btn popup-btn-add-header"
              onClick={() =>
                setHeaders([...headers, { id: ++headerIdRef.current, key: '', value: '' }])
              }
            >
              + Add Header
            </button>
          </div>
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
