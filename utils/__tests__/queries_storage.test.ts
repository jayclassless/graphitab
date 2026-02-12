import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

let mockUuid = 'test-uuid'
vi.mock('uuid', () => ({
  v4: vi.fn(() => mockUuid),
}))

let mockNow = 1000
vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

describe('createSavedQueriesStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.resetModules()
    mockUuid = 'test-uuid'
    mockNow = 1000
  })

  async function createStorage(profileId = 'profile-1') {
    const { createSavedQueriesStorage } = await import('../queries_storage')
    return createSavedQueriesStorage(profileId)
  }

  describe('getAll', () => {
    it('returns an empty array when no queries exist', async () => {
      const storage = await createStorage()
      expect(await storage.getAll()).toEqual([])
    })

    it('returns previously saved queries', async () => {
      const storage = await createStorage()
      mockUuid = 'uuid-1'
      await storage.create('First', '{ a }')
      mockUuid = 'uuid-2'
      mockNow = 2000
      await storage.create('Second', '{ b }')
      const queries = await storage.getAll()
      expect(queries).toHaveLength(2)
      expect(queries[0]).toEqual({
        id: 'uuid-1',
        name: 'First',
        query: '{ a }',
        variables: undefined,
        headers: undefined,
        createdAt: 1000,
      })
      expect(queries[1]).toEqual({
        id: 'uuid-2',
        name: 'Second',
        query: '{ b }',
        variables: undefined,
        headers: undefined,
        createdAt: 2000,
      })
    })
  })

  describe('create', () => {
    it('creates a query with generated id and timestamp', async () => {
      const storage = await createStorage()
      const queries = await storage.create('My Query', '{ hero { name } }')
      expect(queries).toHaveLength(1)
      expect(queries[0]).toEqual({
        id: 'test-uuid',
        name: 'My Query',
        query: '{ hero { name } }',
        variables: undefined,
        headers: undefined,
        createdAt: 1000,
      })
    })

    it('includes optional variables and headers', async () => {
      const storage = await createStorage()
      const queries = await storage.create(
        'My Query',
        '{ hero { name } }',
        '{"id": 1}',
        '{"Authorization": "Bearer token"}'
      )
      expect(queries[0]).toMatchObject({
        variables: '{"id": 1}',
        headers: '{"Authorization": "Bearer token"}',
      })
    })

    it('appends to existing queries', async () => {
      const storage = await createStorage()
      mockUuid = 'uuid-1'
      await storage.create('First', '{ a }')
      mockUuid = 'uuid-2'
      mockNow = 2000
      const queries = await storage.create('Second', '{ b }')
      expect(queries).toHaveLength(2)
      expect(queries[0].id).toBe('uuid-1')
      expect(queries[1].id).toBe('uuid-2')
    })
  })

  describe('save', () => {
    it('adds a new query when id does not exist', async () => {
      const storage = await createStorage()
      const query = {
        id: 'new',
        name: 'New',
        query: '{ a }',
        createdAt: 1000,
      }
      const queries = await storage.save(query)
      expect(queries).toEqual([query])
    })

    it('updates an existing query by id', async () => {
      const storage = await createStorage()
      await storage.create('Original', '{ a }')
      const queries = await storage.save({
        id: 'test-uuid',
        name: 'Updated',
        query: '{ b }',
        createdAt: 1000,
      })
      expect(queries).toHaveLength(1)
      expect(queries[0].name).toBe('Updated')
      expect(queries[0].query).toBe('{ b }')
    })
  })

  describe('remove', () => {
    it('removes a query by id', async () => {
      const storage = await createStorage()
      mockUuid = 'uuid-1'
      await storage.create('First', '{ a }')
      mockUuid = 'uuid-2'
      await storage.create('Second', '{ b }')
      const queries = await storage.remove('uuid-1')
      expect(queries).toHaveLength(1)
      expect(queries[0].id).toBe('uuid-2')
    })

    it('returns all queries unchanged when id does not exist', async () => {
      const storage = await createStorage()
      await storage.create('First', '{ a }')
      const queries = await storage.remove('non-existent')
      expect(queries).toHaveLength(1)
    })
  })

  describe('clear', () => {
    it('removes all queries', async () => {
      const storage = await createStorage()
      await storage.create('First', '{ a }')
      await storage.create('Second', '{ b }')
      await storage.clear()
      expect(await storage.getAll()).toEqual([])
    })
  })

  it('isolates queries between different profile ids', async () => {
    const s1 = await createStorage('profile-1')
    const s2 = await createStorage('profile-2')
    mockUuid = 'uuid-1'
    await s1.create('P1 Query', '{ a }')
    mockUuid = 'uuid-2'
    await s2.create('P2 Query', '{ b }')
    expect(await s1.getAll()).toHaveLength(1)
    expect((await s1.getAll())[0].name).toBe('P1 Query')
    expect(await s2.getAll()).toHaveLength(1)
    expect((await s2.getAll())[0].name).toBe('P2 Query')
  })

  describe('compression', () => {
    it('stores data as a compressed base64 string after create', async () => {
      const storage = await createStorage()
      await storage.create('My Query', '{ hero { name } }')

      const raw = (await fakeBrowser.storage.sync.get('savedQueries:profile-1'))[
        'savedQueries:profile-1'
      ]
      expect(typeof raw).toBe('string')
      expect(raw).toMatch(/^[A-Za-z0-9+/]+=*$/)
      expect(Array.isArray(raw)).toBe(false)
    })
  })
})
