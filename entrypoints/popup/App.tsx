import qs from 'qs'
import { useState, useEffect } from 'react'

import * as profiles from '~/utils/profiles'

import './App.css'
import 'graphiql/style.css'

export default function () {
  const [allProfiles, setAllProfiles] = useState<profiles.Profile[]>([])

  useEffect(() => {
    profiles.getAll().then((profiles) => {
      setAllProfiles(profiles)
    })
  })

  return (
    <div className="popup graphiql-container">
      <div className="popup-title">GraphiTab</div>
      <div className="popup-list">
        {allProfiles.length === 0 ? (
          <div className="popup-empty">No profiles configured</div>
        ) : (
          allProfiles.map((profile) => {
            const params = qs.stringify({ profile: profile.id })
            return (
              <a
                key={profile.id}
                className="popup-profile-link"
                href={`/graphiql.html?${params}`}
                target="_blank"
              >
                {profile.name}
              </a>
            )
          })
        )}
      </div>
    </div>
  )
}
