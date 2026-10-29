import { describe, expect, it } from 'vitest'
import { randomizeDraw } from './drawRandom'

describe('random draw ordering', () => {
  it('keeps every team exactly once and avoids an unchanged redraw', () => {
    const current = ['11', '12', '13', '14']
    const result = randomizeDraw(current, current, () => 0.999)

    expect(result).not.toEqual(current)
    expect([...result].sort()).toEqual([...current].sort())
  })
})
