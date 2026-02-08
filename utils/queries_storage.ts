import { storage } from '#imports'
import { v4 as uuid } from 'uuid'

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
  return storage.defineItem<SavedQuery[]>(`sync:savedQueries:${profileId}`, {
    fallback: [],
  })
}

export function createSavedQueriesStorage(profileId: string): SavedQueriesStorage {
  const storageItem = createSavedQueriesStorageItem(profileId)

  return {
    async getAll(): Promise<SavedQuery[]> {
      return await storageItem.getValue()
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
      const queries = await this.getAll()

      let found = false
      for (let i = 0; i < queries.length; i++) {
        if (queries[i].id === query.id) {
          queries[i] = query
          found = true
          break
        }
      }
      if (!found) {
        queries.push(query)
      }

      await storageItem.setValue(queries)

      return queries
    },

    async remove(id: string): Promise<SavedQuery[]> {
      const newQueries = (await this.getAll()).filter((q) => q.id !== id)
      await storageItem.setValue(newQueries)
      return newQueries
    },

    async clear() {
      await storageItem.removeValue()
    },
  }
}
