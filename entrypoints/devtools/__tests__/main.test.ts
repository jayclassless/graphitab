import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

describe('devtools/main', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.resetModules()
  })

  it('registers the GraphiTab devtools panel', async () => {
    const mockCreate = vi.spyOn(fakeBrowser.devtools.panels, 'create').mockResolvedValue({} as any)

    await import('../main')

    expect(mockCreate).toHaveBeenCalledWith('GraphiTab', '', 'devtools-panel.html')
  })
})
