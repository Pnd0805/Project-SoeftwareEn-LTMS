import { describe, expect, it } from 'vitest'
import { drawPairs, pairKey } from './drawPairs'

describe('drawPairs', () => {
  it('pairs teams in order, the same way the backend builds the first round', () => {
    expect(drawPairs(2, 2)).toEqual([[0, 1]])
    expect(drawPairs(4, 4)).toEqual([[0, 1], [2, 3]])
  })

  it('gives byes to the first seeds', () => {
    expect(drawPairs(5, 8)).toEqual([[0, null], [1, null], [2, null], [3, 4]])
  })
})

describe('pairKey', () => {
  it('ignores which side a team is on', () => {
    expect(pairKey('7', '3')).toBe(pairKey('3', '7'))
  })
})
