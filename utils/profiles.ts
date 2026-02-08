import { storage } from '#imports'
import { v4 as uuid } from 'uuid'

export type Profile = {
  id: string
  name: string
  url: string
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
}

export async function create(name: string, url: string): Promise<Profile> {
  const profiles = await getAll()
  const profile: Profile = {
    id: uuid(),
    name,
    url,
  }
  profiles.push(profile)
  await profilesStorageItem.setValue(profiles)
  return profile
}
