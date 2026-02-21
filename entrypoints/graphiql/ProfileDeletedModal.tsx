import type { Profile } from '~/utils/profiles'
import { restore } from '~/utils/profiles'
import type { SavedQuery } from '~/utils/queries_storage'

import './ProfileDeletedModal.css'

type ProfileDeletedModalProps = {
  profile: Profile
  savedQueries: SavedQuery[]
  onRestored: () => void
}

export default function ProfileDeletedModal({
  profile,
  savedQueries,
  onRestored,
}: ProfileDeletedModalProps) {
  const handleRestore = async () => {
    await restore(profile, savedQueries)
    onRestored()
  }

  const handleClose = () => {
    window.close()
  }

  return (
    <div className="graphiql-container profile-deleted-overlay">
      <div className="profile-deleted-modal">
        <p>
          The profile <strong>{profile.name}</strong> has been deleted.
        </p>
        <div className="profile-deleted-modal-actions">
          <button className="profile-deleted-btn-restore" onClick={handleRestore}>
            Restore
          </button>
          <button className="profile-deleted-btn-close" onClick={handleClose}>
            Close Tab
          </button>
        </div>
      </div>
    </div>
  )
}
