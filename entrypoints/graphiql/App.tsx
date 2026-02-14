import type { GraphiQLPlugin } from '@graphiql/react'

import { explorerPlugin } from '@graphiql/plugin-explorer'
import { createGraphiQLFetcher } from '@graphiql/toolkit'
import { GraphiQL } from 'graphiql'
import { useState, useEffect, useMemo } from 'react'

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
  const profileId = useMemo(
    () => new URLSearchParams(document.location.search).get('profile') ?? undefined,
    []
  )

  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profileId) {
      getProfile(profileId)
        .then((p) => {
          setProfile(p)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    if (profile) {
      document.title = `${profile.name} - ${APP_TITLE}`
    }
  }, [profile])

  const fetcher = useMemo(
    () => (profile ? createGraphiQLFetcher({ url: profile.url, headers: profile.headers }) : null),
    [profile]
  )

  const settingsStorage = useMemo(
    () => (profile ? createGraphiQLSettingsStorage(profile.id) : null),
    [profile]
  )

  const plugins = useMemo(
    () =>
      profile
        ? [explorerPlugin({ showAttribution: false }), createSavedQueriesPlugin(profile.id)]
        : [],
    [profile]
  )

  if (loading) {
    return <div className="graphiql-container graphiqltab-root">Loading...</div>
  }

  if (!profile || !fetcher || !settingsStorage) {
    return <div className="graphiql-container graphiqltab-root">Profile not found</div>
  }

  return <GraphiQL fetcher={fetcher} storage={settingsStorage} plugins={plugins} />
}
