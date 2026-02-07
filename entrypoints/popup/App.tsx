import qs from 'qs'
import { useState, useEffect } from 'react'

import * as profiles from '~/utils/profiles'

export default function () {
  const [allProfiles, setAllProfiles] = useState<profiles.Profile[]>([])

  useEffect(() => {
    profiles.getAll().then((profiles) => {
      setAllProfiles(profiles)
    })
  })

  const profileLinks = allProfiles.map((profile) => {
    const params = qs.stringify({
      profile: profile.id,
    })

    return (
      <div key={profile.id}>
        <a href={`/graphiql.html?${params}`} target="_blank">
          {profile.name}
        </a>
      </div>
    )
  })

  return profileLinks
}
