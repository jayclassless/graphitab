import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}))

const DEFAULT_PROFILES = [
  {
    id: 'swapi',
    name: 'SWAPI: The Star Wars API',
    url: 'https://swapi-graphql.netlify.app/graphql',
  },
  {
    id: 'countries',
    name: 'Countries',
    url: 'https://countries.trevorblades.com/graphql',
  },
]

describe('profiles', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.resetModules()
    localStorage.clear()
  })

  async function importProfiles() {
    return await import('../profiles')
  }

  describe('getAll', () => {
    it('returns default profiles when storage is empty', async () => {
      const { getAll } = await importProfiles()
      const profiles = await getAll()
      expect(profiles).toEqual(DEFAULT_PROFILES)
    })

    it('returns profiles from storage', async () => {
      const custom = [{ id: 'custom', name: 'Custom', url: 'https://example.com/graphql' }]
      await fakeBrowser.storage.sync.set({ profiles: custom })

      const { getAll } = await importProfiles()
      const profiles = await getAll()
      expect(profiles).toEqual(custom)
    })
  })

  describe('get', () => {
    it('returns a profile by id', async () => {
      const { get } = await importProfiles()
      const profile = await get('swapi')
      expect(profile).toEqual(DEFAULT_PROFILES[0])
    })

    it('returns undefined for non-existent id', async () => {
      const { get } = await importProfiles()
      const profile = await get('non-existent')
      expect(profile).toBeUndefined()
    })
  })

  describe('remove', () => {
    it('removes a profile by id', async () => {
      const { remove, getAll } = await importProfiles()
      await remove('swapi')
      const profiles = await getAll()
      expect(profiles).toEqual([DEFAULT_PROFILES[1]])
    })

    it('does nothing when id does not exist', async () => {
      const { remove, getAll } = await importProfiles()
      await remove('non-existent')
      const profiles = await getAll()
      expect(profiles).toEqual(DEFAULT_PROFILES)
    })

    it('clears saved queries for the deleted profile', async () => {
      const { createSavedQueriesStorage } = await import('../queries_storage')
      const storage = createSavedQueriesStorage('swapi')
      await storage.create('My Query', '{ hero { name } }')
      expect(await storage.getAll()).toHaveLength(1)

      const { remove } = await importProfiles()
      await remove('swapi')
      expect(await storage.getAll()).toEqual([])
    })

    it('clears settings for the deleted profile', async () => {
      const { createGraphiQLSettingsStorage } = await import('../settings_storage')
      const settings = createGraphiQLSettingsStorage('swapi')
      settings.setItem('editor', 'vim')
      expect(settings.getItem('editor')).toBe('vim')

      const { remove } = await importProfiles()
      await remove('swapi')
      expect(settings.getItem('editor')).toBeNull()
    })

    it('does not clear data belonging to other profiles', async () => {
      const { createSavedQueriesStorage } = await import('../queries_storage')
      const { createGraphiQLSettingsStorage } = await import('../settings_storage')

      const otherQueries = createSavedQueriesStorage('countries')
      await otherQueries.create('Other Query', '{ countries { name } }')

      const otherSettings = createGraphiQLSettingsStorage('countries')
      otherSettings.setItem('theme', 'dark')

      const { remove } = await importProfiles()
      await remove('swapi')

      expect(await otherQueries.getAll()).toHaveLength(1)
      expect(otherSettings.getItem('theme')).toBe('dark')
    })
  })

  describe('update', () => {
    it('updates name and url of an existing profile', async () => {
      const { update, getAll } = await importProfiles()
      await update('swapi', 'Updated SWAPI', 'https://updated.example.com/graphql')
      const profiles = await getAll()
      expect(profiles[0]).toEqual({
        id: 'swapi',
        name: 'Updated SWAPI',
        url: 'https://updated.example.com/graphql',
      })
    })

    it('returns the updated profile', async () => {
      const { update } = await importProfiles()
      const result = await update('swapi', 'Updated SWAPI', 'https://updated.example.com/graphql')
      expect(result).toEqual({
        id: 'swapi',
        name: 'Updated SWAPI',
        url: 'https://updated.example.com/graphql',
      })
    })

    it('does not modify other profiles', async () => {
      const { update, getAll } = await importProfiles()
      await update('swapi', 'Updated SWAPI', 'https://updated.example.com/graphql')
      const profiles = await getAll()
      expect(profiles[1]).toEqual(DEFAULT_PROFILES[1])
    })

    it('throws when profile ID does not exist', async () => {
      const { update } = await importProfiles()
      await expect(update('non-existent', 'Name', 'https://example.com/graphql')).rejects.toThrow(
        'Profile not found: non-existent'
      )
    })

    it('preserves the profile ID', async () => {
      const { update } = await importProfiles()
      const result = await update('swapi', 'New Name', 'https://new.example.com/graphql')
      expect(result.id).toBe('swapi')
    })

    it('updates with headers', async () => {
      const { update, get } = await importProfiles()
      const hdrs = { 'X-Api-Key': 'abc123' }
      await update('swapi', 'SWAPI', 'https://swapi-graphql.netlify.app/graphql', hdrs)
      const profile = await get('swapi')
      expect(profile!.headers).toEqual({ 'X-Api-Key': 'abc123' })
    })

    it('clears headers when updated without them', async () => {
      const { update, get } = await importProfiles()
      await update('swapi', 'SWAPI', 'https://swapi-graphql.netlify.app/graphql', {
        'X-Api-Key': 'abc',
      })
      await update('swapi', 'SWAPI', 'https://swapi-graphql.netlify.app/graphql')
      const profile = await get('swapi')
      expect(profile!.headers).toBeUndefined()
    })
  })

  describe('watch', () => {
    it('calls the callback when profiles change', async () => {
      const { watch, update } = await importProfiles()
      const callback = vi.fn()
      const unwatch = watch(callback)

      await update('swapi', 'Updated SWAPI', 'https://updated.example.com/graphql')

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'swapi', name: 'Updated SWAPI' })]),
        expect.any(Array)
      )

      unwatch()
    })

    it('returns an unwatch function that stops notifications', async () => {
      const { watch, update } = await importProfiles()
      const callback = vi.fn()
      const unwatch = watch(callback)

      unwatch()

      await update('swapi', 'Updated SWAPI', 'https://updated.example.com/graphql')
      expect(callback).not.toHaveBeenCalled()
    })

    it('falls back to defaults when watch receives null values', async () => {
      const { resolveProfiles } = await importProfiles()
      expect(resolveProfiles(null)).toEqual(DEFAULT_PROFILES)
    })

    it('returns profiles as-is when watch receives non-null values', async () => {
      const { resolveProfiles } = await importProfiles()
      const custom = [{ id: 'x', name: 'X', url: 'https://x.com/graphql' }]
      expect(resolveProfiles(custom)).toBe(custom)
    })
  })

  describe('restore', () => {
    it('re-adds a profile to storage', async () => {
      const { restore, getAll, remove } = await importProfiles()
      const profile = { id: 'swapi', name: 'SWAPI', url: 'https://swapi.dev/graphql' }
      await remove('swapi')
      expect((await getAll()).find((p) => p.id === 'swapi')).toBeUndefined()
      await restore(profile, [])
      expect((await getAll()).find((p) => p.id === 'swapi')).toEqual(profile)
    })

    it('restores saved queries for the profile', async () => {
      const { restore, remove } = await importProfiles()
      const { createSavedQueriesStorage } = await import('../queries_storage')
      const profile = { id: 'swapi', name: 'SWAPI', url: 'https://swapi.dev/graphql' }
      const savedQuery = {
        id: 'q1',
        name: 'My Query',
        query: '{ hero { name } }',
        createdAt: 1000,
      }
      await remove('swapi')
      await restore(profile, [savedQuery])
      const storage = createSavedQueriesStorage('swapi')
      const queries = await storage.getAll()
      expect(queries).toEqual([savedQuery])
    })

    it('restores multiple saved queries', async () => {
      const { restore, remove } = await importProfiles()
      const { createSavedQueriesStorage } = await import('../queries_storage')
      const profile = { id: 'swapi', name: 'SWAPI', url: 'https://swapi.dev/graphql' }
      const queries = [
        { id: 'q1', name: 'Query 1', query: '{ a }', createdAt: 1000 },
        { id: 'q2', name: 'Query 2', query: '{ b }', createdAt: 2000 },
      ]
      await remove('swapi')
      await restore(profile, queries)
      const storage = createSavedQueriesStorage('swapi')
      expect(await storage.getAll()).toEqual(queries)
    })
  })

  describe('create', () => {
    it('creates a new profile with a generated id', async () => {
      const { create } = await importProfiles()
      const profile = await create('New API', 'https://new-api.com/graphql')
      expect(profile).toEqual({
        id: 'test-uuid',
        name: 'New API',
        url: 'https://new-api.com/graphql',
        headers: undefined,
      })
    })

    it('adds the new profile to storage', async () => {
      const { create, getAll } = await importProfiles()
      await create('New API', 'https://new-api.com/graphql')
      const profiles = await getAll()
      expect(profiles).toHaveLength(3)
      expect(profiles[2]).toEqual({
        id: 'test-uuid',
        name: 'New API',
        url: 'https://new-api.com/graphql',
        headers: undefined,
      })
    })

    it('creates a profile with headers', async () => {
      const { create } = await importProfiles()
      const hdrs = { Authorization: 'Bearer token123' }
      const profile = await create('Authed API', 'https://authed.com/graphql', hdrs)
      expect(profile).toEqual({
        id: 'test-uuid',
        name: 'Authed API',
        url: 'https://authed.com/graphql',
        headers: { Authorization: 'Bearer token123' },
      })
    })

    it('creates a profile without headers when omitted', async () => {
      const { create } = await importProfiles()
      const profile = await create('No Headers', 'https://example.com/graphql')
      expect(profile.headers).toBeUndefined()
    })
  })
})
