// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

import { createGraphiQLSettingsStorage } from '../settings_storage'

describe('createGraphiQLSettingsStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('namespaces keys with the given namespace', () => {
    const storage = createGraphiQLSettingsStorage('test')
    storage.setItem('editor', 'vim')
    expect(localStorage.getItem('test:editor')).toBe('vim')
  })

  describe('getItem', () => {
    it('returns the value for a namespaced key', () => {
      localStorage.setItem('ns:key', 'value')
      const storage = createGraphiQLSettingsStorage('ns')
      expect(storage.getItem('key')).toBe('value')
    })

    it('returns null for a missing key', () => {
      const storage = createGraphiQLSettingsStorage('ns')
      expect(storage.getItem('missing')).toBeNull()
    })
  })

  describe('setItem', () => {
    it('stores the value under the namespaced key', () => {
      const storage = createGraphiQLSettingsStorage('ns')
      storage.setItem('foo', 'bar')
      expect(localStorage.getItem('ns:foo')).toBe('bar')
    })

    it('overwrites an existing value', () => {
      const storage = createGraphiQLSettingsStorage('ns')
      storage.setItem('foo', 'bar')
      storage.setItem('foo', 'baz')
      expect(storage.getItem('foo')).toBe('baz')
    })
  })

  describe('removeItem', () => {
    it('removes the namespaced key from localStorage', () => {
      const storage = createGraphiQLSettingsStorage('ns')
      storage.setItem('foo', 'bar')
      storage.removeItem('foo')
      expect(storage.getItem('foo')).toBeNull()
      expect(localStorage.getItem('ns:foo')).toBeNull()
    })

    it('does not throw when removing a non-existent key', () => {
      const storage = createGraphiQLSettingsStorage('ns')
      expect(() => storage.removeItem('missing')).not.toThrow()
    })
  })

  describe('length', () => {
    it('returns 0 when no keys exist for the namespace', () => {
      const storage = createGraphiQLSettingsStorage('ns')
      expect(storage.length).toBe(0)
    })

    it('counts only keys belonging to the namespace', () => {
      localStorage.setItem('ns:a', '1')
      localStorage.setItem('ns:b', '2')
      localStorage.setItem('other:c', '3')
      const storage = createGraphiQLSettingsStorage('ns')
      expect(storage.length).toBe(2)
    })
  })

  describe('clear', () => {
    it('removes only keys belonging to the namespace', () => {
      localStorage.setItem('ns:a', '1')
      localStorage.setItem('ns:b', '2')
      localStorage.setItem('other:c', '3')
      const storage = createGraphiQLSettingsStorage('ns')
      storage.clear()
      expect(localStorage.getItem('ns:a')).toBeNull()
      expect(localStorage.getItem('ns:b')).toBeNull()
      expect(localStorage.getItem('other:c')).toBe('3')
    })
  })

  it('isolates two storages with different namespaces', () => {
    const s1 = createGraphiQLSettingsStorage('one')
    const s2 = createGraphiQLSettingsStorage('two')
    s1.setItem('key', 'a')
    s2.setItem('key', 'b')
    expect(s1.getItem('key')).toBe('a')
    expect(s2.getItem('key')).toBe('b')
  })
})
