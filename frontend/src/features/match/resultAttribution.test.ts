import { describe, expect, it } from 'vitest'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'
import { canConfirm, confirmerOf, resultRecorder } from './resultAttribution'

const result = (over: Partial<MatchResultDto>) => ({ submittedRole: 'referee', ...over }) as MatchResultDto

describe('resultRecorder', () => {
  it('names the recorder when S05 sends their name', () => {
    expect(resultRecorder(result({ submittedBy: { fullName: 'Referee A' } as MatchResultDto['submittedBy'], submittedByVisibility: 'shown' }))).toBe('Referee A')
  })

  /* OD-59 — คนนอกไม่ได้คีย์ submittedBy เลย: บอกบทบาท ไม่ใช่ "ไม่มีชื่อ" ที่อ่านเหมือนข้อมูลหาย */
  it('gives only the role to a viewer who may not know the name', () => {
    expect(resultRecorder(result({ submittedBy: { fullName: '—' } as MatchResultDto['submittedBy'], submittedByVisibility: 'hidden', submittedRole: 'organizer' }))).toBe('the organizer')
  })

  it('says the account is gone when S05 sends submittedBy: null', () => {
    expect(resultRecorder(result({ submittedBy: { fullName: '—' } as MatchResultDto['submittedBy'], submittedByVisibility: 'deleted' }))).toBe('a referee whose account no longer exists')
  })

  it('never prints a placeholder dash as a name', () => {
    expect(resultRecorder(result({ submittedBy: { fullName: '—' } as MatchResultDto['submittedBy'] }))).toBe('a referee')
  })
})

/* OD-55 — ใครเขียนผล อีกฝ่ายรับรอง: เดิมเดาจากโหมด ผลที่กรรมการเขียนในโหมด online จึงโชว์ปุ่ม
   ยืนยันให้กรรมการ (403 SAME_PERSON_CANNOT_VERIFY) และหัวหน้าทีมที่กดได้จริงไม่เห็นปุ่ม */
describe('who confirms a submitted result', () => {
  const match = (mode: 'onsite' | 'online', viewer: Partial<MatchDto['viewer']>) =>
    ({ mode, viewer: { roles: [], isTeamLeader: false, myTeamId: null, ...viewer } }) as unknown as MatchDto
  const submitted = (submittedRole: MatchResultDto['submittedRole'], winnerTeamId = 1) =>
    ({ status: 'submitted', submittedRole, winnerTeamId }) as MatchResultDto

  it('follows the three rows of the backend table', () => {
    expect(confirmerOf('onsite', 'referee')).toBe('winning_leader')
    expect(confirmerOf('online', 'team_leader')).toBe('referee')
    expect(confirmerOf('online', 'referee')).toBe('either_leader')
  })

  it('lets either leader - the losing one too - accept a referee-written online result', () => {
    expect(canConfirm(match('online', { isTeamLeader: true, myTeamId: 2 }), submitted('referee', 1))).toBe(true)
    expect(canConfirm(match('online', { isTeamLeader: true, myTeamId: 1 }), submitted('referee', 1))).toBe(true)
  })

  it('does not offer the referee a confirm on a result the referee wrote', () => {
    expect(canConfirm(match('online', { roles: ['referee'] }), submitted('referee'))).toBe(false)
  })

  it('still sends a leader-written online result to the referee, not to a leader', () => {
    expect(canConfirm(match('online', { roles: ['referee'] }), submitted('team_leader'))).toBe(true)
    expect(canConfirm(match('online', { isTeamLeader: true, myTeamId: 2 }), submitted('team_leader'))).toBe(false)
  })

  it('keeps on-site confirmation with the winning leader only', () => {
    expect(canConfirm(match('onsite', { isTeamLeader: true, myTeamId: 1 }), submitted('referee', 1))).toBe(true)
    expect(canConfirm(match('onsite', { isTeamLeader: true, myTeamId: 2 }), submitted('referee', 1))).toBe(false)
  })
})
