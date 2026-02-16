import type { GraphiQLPlugin } from '@graphiql/react'

import { explorerPlugin } from '@graphiql/plugin-explorer'
import { createGraphiQLFetcher } from '@graphiql/toolkit'
import { GraphiQL } from 'graphiql'
import { useState, useEffect, useMemo, useRef } from 'react'

import { get as getProfile, watch as watchProfiles, type Profile } from '~/utils/profiles'
import { createSavedQueriesStorage, type SavedQuery } from '~/utils/queries_storage'
import { createGraphiQLSettingsStorage } from '~/utils/settings_storage'

import ProfileDeletedModal from './ProfileDeletedModal'
import SavedQueriesContent from './SavedQueriesContent'
import SavedQueriesIcon from './SavedQueriesIcon'
import './App.css'
import 'graphiql/style.css'
import '@graphiql/plugin-explorer/style.css'

const APP_TITLE = 'GraphiTab'

function headersEqual(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => b[key] === a[key])
}

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
  const profileRef = useRef<Profile | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [deleted, setDeleted] = useState<{ profile: Profile; savedQueries: SavedQuery[] } | null>(
    null
  )
  const savedQueriesRef = useRef<SavedQuery[]>([])

  useEffect(() => {
    if (profileId) {
      getProfile(profileId)
        .then((p) => {
          profileRef.current = p
          setProfile(p)
          if (p) {
            createSavedQueriesStorage(p.id)
              .getAll()
              .then((queries) => {
                savedQueriesRef.current = queries
              })
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    if (!profileId) return
    return createSavedQueriesStorage(profileId).watch((queries) => {
      savedQueriesRef.current = queries
    })
  }, [profileId])

  useEffect(() => {
    if (!profileId) return
    return watchProfiles((newProfiles) => {
      const updated = newProfiles.find((p) => p.id === profileId)
      if (updated) {
        const prev = profileRef.current
        if (
          prev &&
          prev.name === updated.name &&
          prev.url === updated.url &&
          headersEqual(prev.headers, updated.headers)
        ) {
          return
        }
        profileRef.current = updated
        setProfile(updated)
      } else if (profileRef.current) {
        setDeleted({ profile: profileRef.current, savedQueries: savedQueriesRef.current })
      }
    })
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

  return (
    <>
      <GraphiQL fetcher={fetcher} storage={settingsStorage} plugins={plugins} />
      {deleted && (
        <ProfileDeletedModal
          profile={deleted.profile}
          savedQueries={deleted.savedQueries}
          onRestored={() => setDeleted(null)}
        />
      )}
    </>
  )
}
