import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScoreInputs } from './ScoreInputs'
import { scoreFormatFromError, validMatchScore } from './scoreFormat'
import { ApiError } from '../../api/client'
import type { MatchDto } from '../../types/match.dto'
const sides = { teamA: { name: 'Alpha' }, teamB: { name: 'Beta' } } as Pick<MatchDto, 'teamA' | 'teamB'>
describe('server BO score choices', () => {
  it('offers both winners using exactly the delivered pairs and never accepts a per-game score', () => {
    const setA = vi.fn(); const setB = vi.fn()
    const m = { ...sides, bestOf: 3, possibleScores: [[2, 0], [2, 1]] as [number, number][] }
    render(<ScoreInputs match={m} a={0} b={0} setA={setA} setB={setB} prefix="test" />)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Alpha 1 – 2 Beta' }))
    expect(setA).toHaveBeenCalledWith(1); expect(setB).toHaveBeenCalledWith(2)
    expect(validMatchScore(m, 21, 19)).toBe(false)
    expect(validMatchScore(m, 1, 2)).toBe(true)
  })
  it('keeps football scores unrestricted when bestOf is null and possibleScores is empty', () => {
    render(<ScoreInputs match={{ ...sides, bestOf: null, possibleScores: [] }} a={1200} b={2} setA={vi.fn()} setB={vi.fn()} prefix="test" />)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2)
    expect(validMatchScore({ bestOf: null, possibleScores: [] }, 1200, 2)).toBe(true)
  })
  it.each(['PICK_SCORE_NOT_IN_MATCH_FORMAT', 'SCORE_NOT_IN_MATCH_FORMAT'])('recovers the changed format from %s', code => {
    const format = scoreFormatFromError({ bestOf: 3 }, new ApiError(422, { code, message: 'Changed', bestOf: 7, possibleScores: [[4, 0], [4, 3]] }))
    expect(validMatchScore(format, 2, 0)).toBe(false)
    expect(validMatchScore(format, 4, 3)).toBe(true)
  })
})
