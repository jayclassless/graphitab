// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

import '../monaco-setup'

describe('monaco-setup', () => {
  it('sets window.MonacoEnvironment', () => {
    expect(window.MonacoEnvironment).toBeDefined()
  })

  it('getWorkerUrl returns the graphql worker for the graphql label', () => {
    const url = window.MonacoEnvironment!.getWorkerUrl!('any', 'graphql')
    expect(url).toMatch(/\/workers\/graphql\.worker\.js$/)
  })

  it('getWorkerUrl returns the json worker for the json label', () => {
    const url = window.MonacoEnvironment!.getWorkerUrl!('any', 'json')
    expect(url).toMatch(/\/workers\/json\.worker\.js$/)
  })

  it('getWorkerUrl returns the editor worker for any other label', () => {
    for (const label of ['typescript', 'html', 'css', '']) {
      const url = window.MonacoEnvironment!.getWorkerUrl!('any', label)
      expect(url).toMatch(/\/workers\/editor\.worker\.js$/)
    }
  })

  it('worker URLs are based on document.baseURI', () => {
    const expectedBase = new URL('workers/', document.baseURI).href
    for (const label of ['graphql', 'json', 'typescript']) {
      const url = window.MonacoEnvironment!.getWorkerUrl!('any', label)
      expect(url).toContain(expectedBase)
    }
  })
})
