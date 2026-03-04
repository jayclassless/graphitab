// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { useDarkMode } from '../useDarkMode'

function makeMatchMedia(matches: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = []
  return {
    mql: {
      matches,
      addEventListener: vi.fn((_: string, fn: (e: { matches: boolean }) => void) => {
        listeners.push(fn)
      }),
      removeEventListener: vi.fn((_: string, fn: (e: { matches: boolean }) => void) => {
        const i = listeners.indexOf(fn)
        if (i !== -1) listeners.splice(i, 1)
      }),
    },
    fire(newMatches: boolean) {
      listeners.forEach((fn) => fn({ matches: newMatches }))
    },
  }
}

describe('useDarkMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when prefers-color-scheme is light', () => {
    const { mql } = makeMatchMedia(false)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql)
    )
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(false)
  })

  it('returns true when prefers-color-scheme is dark', () => {
    const { mql } = makeMatchMedia(true)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql)
    )
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(true)
  })

  it('updates when the media query fires a change event', () => {
    const { mql, fire } = makeMatchMedia(false)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql)
    )
    const { result } = renderHook(() => useDarkMode())
    expect(result.current).toBe(false)

    act(() => fire(true))
    expect(result.current).toBe(true)

    act(() => fire(false))
    expect(result.current).toBe(false)
  })

  it('removes the event listener on unmount', () => {
    const { mql } = makeMatchMedia(false)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql)
    )
    const { unmount } = renderHook(() => useDarkMode())
    expect(mql.addEventListener).toHaveBeenCalledTimes(1)
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1)
    expect(mql.removeEventListener.mock.calls[0][0]).toBe('change')
  })
})
