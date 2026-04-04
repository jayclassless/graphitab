import { explorerPlugin } from '@graphiql/plugin-explorer'
import type { GraphiQLPlugin, TabsState } from '@graphiql/react'
import { createGraphiQLFetcher } from '@graphiql/toolkit'
import { GraphiQL } from 'graphiql'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

import { backgroundFetch } from '~/utils/background_fetch'
import { consumeInitialState, type GraphiQLInitialState } from '~/utils/open_in_graphiql'
import { get as getProfile, watch as watchProfiles, type Profile } from '~/utils/profiles'
import { createSavedQueriesStorage, type SavedQuery } from '~/utils/queries_storage'
import { createGraphiQLSettingsStorage } from '~/utils/settings_storage'

import ExtensionsModal from './ExtensionsModal'
import ExtensionsToolbarButton from './ExtensionsToolbarButton'
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

export function createSavedQueriesPlugin(
  profileId: string,
  extensionsRef: React.RefObject<string>,
  onExtensionsChange: (value: string) => void
): GraphiQLPlugin {
  const storage = createSavedQueriesStorage(profileId)

  return {
    title: 'Saved Queries',
    icon: SavedQueriesIcon,
    content: () => (
      <SavedQueriesContent
        storage={storage}
        extensionsRef={extensionsRef}
        onExtensionsChange={onExtensionsChange}
      />
    ),
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
  const [initialState, setInitialState] = useState<GraphiQLInitialState | null>(null)

  const extensionsMapRef = useRef(new Map<string, string>())
  const activeTabIdRef = useRef('')
  const extensionsRef = useRef('')
  const [extensions, setExtensions] = useState('')
  const [showExtensionsModal, setShowExtensionsModal] = useState(false)

  const updateExtensions = useCallback((value: string) => {
    extensionsRef.current = value
    setExtensions(value)
    if (activeTabIdRef.current) {
      if (value) {
        extensionsMapRef.current.set(activeTabIdRef.current, value)
      } else {
        extensionsMapRef.current.delete(activeTabIdRef.current)
      }
    }
  }, [])

  const handleTabChange = useCallback((tabsState: TabsState) => {
    const activeTab = tabsState.tabs[tabsState.activeTabIndex]
    if (!activeTab || activeTab.id === activeTabIdRef.current) return
    // First tab initialization: adopt any extensions set before we knew the tab ID
    if (!activeTabIdRef.current && extensionsRef.current) {
      extensionsMapRef.current.set(activeTab.id, extensionsRef.current)
    }
    activeTabIdRef.current = activeTab.id
    const ext = extensionsMapRef.current.get(activeTab.id) || ''
    extensionsRef.current = ext
    setExtensions(ext)
  }, [])

  useEffect(() => {
    if (profileId) {
      Promise.all([getProfile(profileId), consumeInitialState(profileId)])
        .then(([p, state]) => {
          profileRef.current = p
          setProfile(p)
          if (state) {
            setInitialState(state)
            if (state.extensions) {
              extensionsRef.current = state.extensions
              setExtensions(state.extensions)
            }
          }
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

  const fetcher = useMemo(() => {
    if (!profile) return null
    const subscriptionUrl = profile.url.replace(/^http/, 'ws')
    const baseFetcher = createGraphiQLFetcher({
      url: profile.url,
      headers: profile.headers,
      subscriptionUrl,
      fetch: backgroundFetch,
    })
    return ((params: Record<string, unknown>, opts?: Record<string, unknown>) => {
      const ext = extensionsRef.current
      if (ext) {
        return baseFetcher({ ...params, extensions: JSON.parse(ext) } as never, opts as never)
      }
      return baseFetcher(params as never, opts as never)
    }) as typeof baseFetcher
  }, [profile])

  const settingsStorage = useMemo(
    () => (profile ? createGraphiQLSettingsStorage(profile.id) : null),
    [profile]
  )

  const plugins = useMemo(
    () =>
      profile
        ? [
            explorerPlugin({ showAttribution: false }),
            createSavedQueriesPlugin(profile.id, extensionsRef, updateExtensions),
          ]
        : [],
    [profile, updateExtensions]
  )

  if (loading) {
    return <div className="graphiql-container graphiqltab-root">Loading...</div>
  }

  if (!profile || !fetcher || !settingsStorage) {
    return <div className="graphiql-container graphiqltab-root">Profile not found</div>
  }

  return (
    <>
      <GraphiQL
        fetcher={fetcher}
        storage={settingsStorage}
        plugins={plugins}
        onTabChange={handleTabChange}
        initialQuery={initialState?.query}
        initialVariables={initialState?.variables ?? undefined}
        initialHeaders={initialState?.headers ?? undefined}
      >
        <GraphiQL.Toolbar>
          {({ prettify, copy, merge }) => (
            <>
              {prettify}
              {merge}
              {copy}
              <ExtensionsToolbarButton
                hasExtensions={!!extensions.trim()}
                onClick={() => setShowExtensionsModal(true)}
              />
            </>
          )}
        </GraphiQL.Toolbar>
      </GraphiQL>
      {showExtensionsModal && (
        <ExtensionsModal
          value={extensions}
          onSave={updateExtensions}
          onClose={() => setShowExtensionsModal(false)}
        />
      )}
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
