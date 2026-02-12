import { storage } from '#imports'
import { v4 as uuid } from 'uuid'

import { compress, decompress } from './compression'

export type SavedQuery = {
  id: string
  name: string
  query: string
  variables?: string
  headers?: string
  createdAt: number
}

export type SavedQueriesStorage = {
  getAll(): Promise<SavedQuery[]>
  create(name: string, query: string, variables?: string, headers?: string): Promise<SavedQuery[]>
  save(query: SavedQuery): Promise<SavedQuery[]>
  remove(id: string): Promise<SavedQuery[]>
  clear(): Promise<void>
}

function createSavedQueriesStorageItem(profileId: string) {
  return storage.defineItem<string>(`sync:savedQueries:${profileId}`)
}

export function createSavedQueriesStorage(profileId: string): SavedQueriesStorage {
  const storageItem = createSavedQueriesStorageItem(profileId)

  async function readQueries(): Promise<SavedQuery[]> {
    const raw = await storageItem.getValue()
    if (raw == null) return []
    return JSON.parse(await decompress(raw)) as SavedQuery[]
  }

  async function writeQueries(queries: SavedQuery[]): Promise<void> {
    await storageItem.setValue(await compress(JSON.stringify(queries)))
  }

  return {
    async getAll(): Promise<SavedQuery[]> {
      return await readQueries()
    },

    async create(
      name: string,
      query: string,
      variables?: string,
      headers?: string
    ): Promise<SavedQuery[]> {
      const newQuery = {
        id: uuid(),
        name,
        query,
        variables,
        headers,
        createdAt: Date.now(),
      }

      return await this.save(newQuery)
    },

    async save(query: SavedQuery): Promise<SavedQuery[]> {
      const queries = [...(await this.getAll())]

      const idx = queries.findIndex((q) => q.id === query.id)
      if (idx >= 0) {
        queries[idx] = query
      } else {
        queries.push(query)
      }

      await writeQueries(queries)

      return queries
    },

    async remove(id: string): Promise<SavedQuery[]> {
      const newQueries = (await this.getAll()).filter((q) => q.id !== id)
      await writeQueries(newQueries)
      return newQueries
    },

    async clear() {
      await storageItem.removeValue()
    },
  }
}
