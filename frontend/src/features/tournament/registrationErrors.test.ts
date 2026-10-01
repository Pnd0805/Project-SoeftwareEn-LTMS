import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { conflictOfInterestDetails, registrationMemberFailures } from './registrationErrors'
const members = [{ userId: 1, fullName: 'Alice' }, { userId: 2, fullName: 'Bob' }]

describe('registration member feedback', () => {
  it('names all organizer/referee conflicts from the actual conflicts array', () => {
    const error = new ApiError(409, { code: 'TEAM_CONFLICT_OF_INTEREST', message: 'conflict', conflicts: [
      { userId: 1, role: 'organizer' }, { userId: 2, role: 'referee' },
    ] })
    const rows = registrationMemberFailures(error, members)
    expect(rows.map(r => r.fullName)).toEqual(['Alice', 'Bob'])
    expect(rows[0].reason).toContain('ผู้จัด')
    expect(rows[1].reason).toContain('กรรมการ')
    expect(conflictOfInterestDetails(error, members).at(-1)).toContain('including unchecked players')
    expect(conflictOfInterestDetails(error, members).at(-1)).toContain('Deselecting the player does not resolve it')
  })
  it('preserves hard-filter causes and groups nothing into a fabricated pass', () => {
    const error = new ApiError(422, { code: 'HARD_FILTER_FAILED', message: 'rules', details: [
      { userId: 1, fullName: 'Alice', reason: 'gender' },
      { userId: 1, fullName: 'Alice', reason: 'age' },
      { userId: 2, fullName: 'Bob', reason: 'year' },
      { userId: 2, fullName: 'Bob', reason: 'faculty' },
    ] })
    const rows = registrationMemberFailures(error, members)
    expect(rows.map(r => r.reason)).toEqual(['ไม่ผ่านเงื่อนไขเพศ', 'ไม่ผ่านเงื่อนไขอายุ', 'ไม่ผ่านเงื่อนไขชั้นปี', 'ไม่ผ่านเงื่อนไขคณะ'])
  })
  it('identifies members removed from the team and uses an ID when no name is readable', () => {
    const error = new ApiError(422, { code: 'PLAYER_NOT_IN_TEAM', message: 'membership', userIds: [1, 99] })
    expect(registrationMemberFailures(error, members).map(r => r.fullName)).toEqual(['Alice', 'User #99'])
  })
  it('names the other team when a player already registered there', () => {
    const error = new ApiError(409, { code: 'PLAYER_ALREADY_REGISTERED', message: 'duplicate', players: [
      { userId: 1, fullName: 'Alice', teamId: 5, teamName: 'Other squad' },
    ] })
    expect(registrationMemberFailures(error, members)[0].reason).toContain('Other squad')
  })
  it('does not guess a player or a referee role when details are absent', () => {
    const error = new ApiError(409, { code: 'TEAM_CONFLICT_OF_INTEREST', message: 'conflict' })
    expect(registrationMemberFailures(error, members)).toEqual([])
    expect(conflictOfInterestDetails(error, members)[0]).toContain('did not identify the member')
  })
  it('ignores malformed IDs and deduplicates repeated causes', () => {
    const error = new ApiError(409, { code: 'TEAM_CONFLICT_OF_INTEREST', message: 'conflict', conflicts: [
      null, { userId: '1', role: 'referee' }, { userId: 1, role: 'referee' }, { userId: 1, role: 'referee' },
    ] })
    expect(registrationMemberFailures(error, members)).toHaveLength(1)
  })
})