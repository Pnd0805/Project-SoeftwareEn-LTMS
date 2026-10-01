import { describe, expect, it } from 'vitest'
import type { MatchResultDto } from '../../types/match.dto'
import { resultRecorder } from './resultAttribution'
describe('result recorder', () => {
  it('uses a supplied name and never guesses a missing recorder name', () => {
    expect(resultRecorder({ submittedBy: { fullName: 'Referee A' }, submittedRole: 'referee' } as MatchResultDto)).toBe('Referee A')
    expect(resultRecorder({ submittedBy: { fullName: '\u2014' }, submittedRole: 'organizer' } as MatchResultDto)).toBe('the organizer (name not provided)')
  })
})
