import { storage } from '#imports'

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
