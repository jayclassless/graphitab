import { describe, it, expect } from 'vitest'

import background from '../background'

describe('background', () => {
  it('exports a background definition', () => {
    expect(background).toBeDefined()
  })
})
