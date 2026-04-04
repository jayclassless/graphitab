import { useEffect, useRef, useState } from 'react'

import '~/styles/shared.css'
import './ProfileNamePrompt.css'

type Props = {
  url: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function ProfileNamePrompt({ url, onConfirm, onCancel }: Props) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const trimmedName = name.trim()

  function handleSubmit() {
    if (trimmedName) onConfirm(trimmedName)
  }

  return (
    <div className="gt-modal-backdrop" onClick={onCancel}>
      <div className="gt-profile-prompt" onClick={(e) => e.stopPropagation()}>
        <h3>Create Profile</h3>
        <p className="gt-profile-prompt-message">No profile matches this endpoint:</p>
        <p className="gt-profile-prompt-url">{url}</p>
        <input
          ref={inputRef}
          type="text"
          className="gt-input"
          placeholder="Profile name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        <div className="gt-profile-prompt-actions">
          <button className="gt-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="gt-btn" disabled={!trimmedName} onClick={handleSubmit}>
            Create &amp; Open
          </button>
        </div>
      </div>
    </div>
  )
}
