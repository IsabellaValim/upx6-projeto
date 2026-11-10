import { describe, expect, it } from 'vitest'

describe('setup', () => {
  it('vitest + jsdom funcionam', () => {
    expect(document.body).toBeTruthy()
  })
})
