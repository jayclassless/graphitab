import type { GraphiQLPlugin } from '@graphiql/react'

import { explorerPlugin } from '@graphiql/plugin-explorer'
import { createGraphiQLFetcher } from '@graphiql/toolkit'
import { GraphiQL } from 'graphiql'
import qs from 'qs'
import { useState, useEffect } from 'react'

import { get as getProfile, type Profile } from '~/utils/profiles'
import { createSavedQueriesStorage } from '~/utils/queries_storage'
import { createGraphiQLSettingsStorage } from '~/utils/settings_storage'

import SavedQueriesContent from './SavedQueriesContent'
import SavedQueriesIcon from './SavedQueriesIcon'
import './App.css'
import 'graphiql/style.css'
import '@graphiql/plugin-explorer/style.css'

const APP_TITLE = 'GraphiTab'

export function createSavedQueriesPlugin(profileId: string): GraphiQLPlugin {
  const storage = createSavedQueriesStorage(profileId)

  return {
    title: 'Saved Queries',
    icon: SavedQueriesIcon,
    content: () => <SavedQueriesContent storage={storage} />,
  }
}

export default function App() {
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
    return <div className="graphiql-container graphiqltab-root">Loading...</div>
  }

  if (!profile) {
    return <div className="graphiql-container graphiqltab-root">Profile not found</div>
  }

  const fetcher = createGraphiQLFetcher({
    url: profile.url,
  })

  const settingsStorage = createGraphiQLSettingsStorage(profile.id)

  const plugins = [
    explorerPlugin({
      showAttribution: false,
    }),
    createSavedQueriesPlugin(profile.id),
  ]

  return <GraphiQL fetcher={fetcher} storage={settingsStorage} plugins={plugins} />
}
