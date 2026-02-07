import type { Storage as GraphiQLStorage } from '@graphiql/toolkit'

function getAllKeys(prefix: string): string[] {
  let keys: string[] = []

  for (const key in localStorage) {
    if (key.startsWith(prefix)) {
      keys.push(key)
    }
  }

  return keys
}

// Adapted from the default implementation of a storage in
// https://github.com/graphql/graphiql/blob/main/packages/graphiql-toolkit/src/storage/base.ts
export function createGraphiQLStorage(namespace: string): GraphiQLStorage {
  const makeKey = (key: string): string => {
    return `${namespace}:${key}`
  }

  return {
    getItem: (key: string): string | null => {
      return localStorage.getItem(makeKey(key))
    },

    setItem: (key: string, value: string) => {
      return localStorage.setItem(makeKey(key), value)
    },

    removeItem: (key: string) => {
      return localStorage.removeItem(makeKey(key))
    },

    get length() {
      return getAllKeys(makeKey('')).length
    },

    clear: () => {
      for (const key in getAllKeys(makeKey(''))) {
        localStorage.removeItem(key)
      }
    },
  }
}
