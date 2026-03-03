import { renderHook, act } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { useDevtoolsSettings, FILTER_TYPES, DEFAULT_COLUMN_WIDTHS } from '../useDevtoolsSettings'

describe('useDevtoolsSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('defaults to preserveLog=false and all FILTER_TYPES active when storage is empty', async () => {
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    expect(result.current.preserveLog).toBe(false)
    expect(result.current.activeTypes).toEqual(new Set(FILTER_TYPES))
  })

  it('reads preserveLog=true from storage on init', async () => {
    await fakeBrowser.storage.local.set({ 'devtools.preserveLog': true })
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    expect(result.current.preserveLog).toBe(true)
  })

  it('reads partial activeTypes from storage on init', async () => {
    await fakeBrowser.storage.local.set({ 'devtools.activeTypes': ['query'] })
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    expect(result.current.activeTypes).toEqual(new Set(['query']))
  })

  it('setPreserveLog(true) updates state and writes to storage', async () => {
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    await act(async () => {
      result.current.setPreserveLog(true)
    })
    expect(result.current.preserveLog).toBe(true)
    const stored = await fakeBrowser.storage.local.get('devtools.preserveLog')
    expect(stored['devtools.preserveLog']).toBe(true)
  })

  it('toggleType deactivates a type and writes updated array to storage', async () => {
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    await act(async () => {
      result.current.toggleType('query')
    })
    expect(result.current.activeTypes.has('query')).toBe(false)
    const stored = await fakeBrowser.storage.local.get('devtools.activeTypes')
    expect(stored['devtools.activeTypes']).toEqual(['mutation'])
  })

  it('toggleType reactivates a type when toggled again', async () => {
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    await act(async () => {
      result.current.toggleType('query')
    })
    expect(result.current.activeTypes.has('query')).toBe(false)
    await act(async () => {
      result.current.toggleType('query')
    })
    expect(result.current.activeTypes.has('query')).toBe(true)
    const stored = await fakeBrowser.storage.local.get('devtools.activeTypes')
    expect(stored['devtools.activeTypes']).toContain('query')
  })

  it('columnWidths defaults to DEFAULT_COLUMN_WIDTHS when storage is empty', async () => {
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    expect(result.current.columnWidths).toEqual(DEFAULT_COLUMN_WIDTHS)
  })

  it('reads persisted columnWidths from storage on init', async () => {
    const customWidths = [300, 150, 80, 120]
    await fakeBrowser.storage.local.set({ 'devtools.columnWidths': customWidths })
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    expect(result.current.columnWidths).toEqual(customWidths)
  })

  it('setColumnWidths updates state and writes to storage', async () => {
    const { result } = renderHook(() => useDevtoolsSettings())
    await act(async () => {})
    const newWidths = [250, 80, 90, 110]
    await act(async () => {
      result.current.setColumnWidths(newWidths)
    })
    expect(result.current.columnWidths).toEqual(newWidths)
    const stored = await fakeBrowser.storage.local.get('devtools.columnWidths')
    expect(stored['devtools.columnWidths']).toEqual(newWidths)
  })
})
