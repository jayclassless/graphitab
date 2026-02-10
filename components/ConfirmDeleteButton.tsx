import './ConfirmDeleteButton.css'

interface ConfirmDeleteButtonProps {
  isConfirming: boolean
  onDelete: () => void
  onCancel: () => void
}

export default function ConfirmDeleteButton({
  isConfirming,
  onDelete,
  onCancel,
}: ConfirmDeleteButtonProps) {
  if (isConfirming) {
    return (
      <div className="confirm-delete-wrapper">
        <button className="confirm-delete-confirm" onClick={onDelete}>
          Confirm
        </button>
        <button className="confirm-delete-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button className="confirm-delete-btn" onClick={onDelete} title="Delete" aria-label="Delete">
      ×
    </button>
  )
}
