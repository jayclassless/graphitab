import { describe, it, expect } from 'vitest'

import { compress, decompress } from '../compression'

describe('compress / decompress', () => {
  it('round-trips a simple string', async () => {
    const input = 'hello world'
    const compressed = await compress(input)
    expect(await decompress(compressed)).toBe(input)
  })

  it('round-trips a JSON array', async () => {
    const input = JSON.stringify([
      { id: '1', name: 'Query 1', query: '{ hero { name } }' },
      { id: '2', name: 'Query 2', query: '{ villain { name } }' },
    ])
    const compressed = await compress(input)
    expect(await decompress(compressed)).toBe(input)
  })

  it('round-trips an empty array', async () => {
    const input = JSON.stringify([])
    const compressed = await compress(input)
    expect(await decompress(compressed)).toBe(input)
  })

  it('produces valid base64 output', async () => {
    const compressed = await compress('test data')
    expect(compressed).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('handles large data without stack overflow', async () => {
    const input = 'x'.repeat(500_000)
    const compressed = await compress(input)
    expect(await decompress(compressed)).toBe(input)
  })
})
