import type { Storage as GraphiQLStorage } from '@graphiql/toolkit'

function getAllKeys(prefix: string): string[] {
  const keys: string[] = []

  for (const key in localStorage) {
    if (key.startsWith(prefix)) {
      keys.push(key)
    }
  }

  return keys
}

// Adapted from the default implementation of a storage in
// https://github.com/graphql/graphiql/blob/main/packages/graphiql-toolkit/src/storage/base.ts
export function createGraphiQLSettingsStorage(namespace: string): GraphiQLStorage {
  const makeKey = (key: string): string => {
    return `graphitab:${namespace}:${key}`
  }

  return {
    getItem: (key: string): string | null => {
      return localStorage.getItem(makeKey(key))
    },

    setItem: (key: string, value: string) => {
      localStorage.setItem(makeKey(key), value)
    },

    removeItem: (key: string) => {
      localStorage.removeItem(makeKey(key))
    },

    get length() {
      return getAllKeys(makeKey('')).length
    },

    clear: () => {
      for (const key of getAllKeys(makeKey(''))) {
        localStorage.removeItem(key)
      }
    },
  }
}
