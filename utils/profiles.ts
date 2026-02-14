import { storage } from '#imports'
import { v4 as uuid } from 'uuid'

import { createSavedQueriesStorage } from './queries_storage'
import { createGraphiQLSettingsStorage } from './settings_storage'

export type Profile = {
  id: string
  name: string
  url: string
  headers?: Record<string, string>
}

const DEFAULT: Profile[] = [
  // https://github.com/graphql/swapi-graphql
  {
    id: 'swapi',
    name: 'SWAPI: The Star Wars API',
    url: 'https://swapi-graphql.netlify.app/graphql',
  },

  // https://github.com/trevorblades/countries
  {
    id: 'countries',
    name: 'Countries',
    url: 'https://countries.trevorblades.com/graphql',
  },
]

const profilesStorageItem = storage.defineItem<Profile[]>('sync:profiles', {
  fallback: DEFAULT,
})

export async function getAll(): Promise<Profile[]> {
  return await profilesStorageItem.getValue()
}

export async function get(id: string): Promise<Profile | undefined> {
  return (await getAll()).find((p) => p.id === id)
}

export async function remove(id: string): Promise<void> {
  const profiles = (await getAll()).filter((p) => p.id !== id)
  await profilesStorageItem.setValue(profiles)
  await createSavedQueriesStorage(id).clear()
  createGraphiQLSettingsStorage(id).clear()
}

export async function update(
  id: string,
  name: string,
  url: string,
  headers?: Record<string, string>
): Promise<Profile> {
  const profiles = await getAll()
  const index = profiles.findIndex((p) => p.id === id)
  if (index === -1) throw new Error(`Profile not found: ${id}`)
  profiles[index] = { ...profiles[index], name, url, headers }
  await profilesStorageItem.setValue(profiles)
  return profiles[index]
}

export function watch(
  callback: (newProfiles: Profile[], oldProfiles: Profile[]) => void
): () => void {
  return profilesStorageItem.watch((newValue, oldValue) => {
    callback(newValue ?? DEFAULT, oldValue ?? DEFAULT)
  })
}

export async function create(
  name: string,
  url: string,
  headers?: Record<string, string>
): Promise<Profile> {
  const profiles = await getAll()
  const profile: Profile = {
    id: uuid(),
    name,
    url,
    headers,
  }
  profiles.push(profile)
  await profilesStorageItem.setValue(profiles)
  return profile
}
