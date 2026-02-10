import { useState } from 'react'

import '~/styles/shared.css'
import './ConfirmDeleteButton.css'

interface ConfirmDeleteButtonProps {
  onDelete: () => void
}

export default function ConfirmDeleteButton({ onDelete }: ConfirmDeleteButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  if (isConfirming) {
    return (
      <div className="confirm-delete-wrapper">
        <button
          className="gt-btn confirm-delete-confirm"
          onClick={() => {
            setIsConfirming(false)
            onDelete()
          }}
        >
          Confirm
        </button>
        <button className="gt-btn confirm-delete-cancel" onClick={() => setIsConfirming(false)}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      className="confirm-delete-btn"
      onClick={() => setIsConfirming(true)}
      title="Delete"
      aria-label="Delete"
    >
      ×
    </button>
  )
}
