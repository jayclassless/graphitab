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
  })

  describe('create', () => {
    it('creates a new profile with a generated id', async () => {
      const { create } = await importProfiles()
      const profile = await create('New API', 'https://new-api.com/graphql')
      expect(profile).toEqual({
        id: 'test-uuid',
        name: 'New API',
        url: 'https://new-api.com/graphql',
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
      })
    })
  })
})
