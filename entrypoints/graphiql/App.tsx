import { explorerPlugin } from '@graphiql/plugin-explorer'
import { createGraphiQLFetcher } from '@graphiql/toolkit'
import { GraphiQL } from 'graphiql'
import qs from 'qs'
import { useState, useEffect } from 'react'

import { get as getProfile, type Profile } from '~/utils/profiles'
import { createGraphiQLStorage } from '~/utils/storage'

import './App.css'
import 'graphiql/style.css'
import '@graphiql/plugin-explorer/style.css'

const APP_TITLE = 'GraphiTab'

export default function () {
  const query = qs.parse(document.location.search.slice(1))

  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const profileId = query.profile as string
    if (profileId) {
      getProfile(profileId)
        .then((p) => {
          setProfile(p)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [query.profile])

  useEffect(() => {
    if (profile) {
      document.title = `${profile.name} - ${APP_TITLE}`
    }
  }, [profile])

  if (loading) {
    return <div className="graphiqltab-root">Loading...</div>
  }

  let elem
  if (profile) {
    const fetcher = createGraphiQLFetcher({
      url: profile.url,
    })

    const storage = createGraphiQLStorage(profile.id)

    const plugins = [
      explorerPlugin({
        showAttribution: false,
      }),
    ]

    elem = <GraphiQL fetcher={fetcher} storage={storage} plugins={plugins} />
  }

  return elem
}
