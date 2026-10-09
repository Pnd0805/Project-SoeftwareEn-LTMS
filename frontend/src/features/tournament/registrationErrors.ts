import { ApiError } from '../../api/client'
import { refereeInvitationRecovery } from '../../shared/refereeRecovery'

export type RegistrationMember = { userId: number; fullName: string }
export type RegistrationMemberFailure = RegistrationMember & { reason: string }
const ruleNames: Record<string, string> = {
  gender: 'ไม่ผ่านเงื่อนไขเพศ', age: 'ไม่ผ่านเงื่อนไขอายุ',
  year: 'ไม่ผ่านเงื่อนไขชั้นปี', faculty: 'ไม่ผ่านเงื่อนไขคณะ',
}
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null

/** Names and causes come from the server; member rows only resolve returned user IDs. */
export function registrationMemberFailures(error: ApiError, members: RegistrationMember[] = []): RegistrationMemberFailure[] {
  const name = (id: number, value?: unknown) => typeof value === 'string' && value.trim()
    ? value : members.find(m => m.userId === id)?.fullName ?? `User #${id}`
  const rows: RegistrationMemberFailure[] = []
  const add = (value: unknown, reason: (row: Record<string, unknown>) => string) => {
    const row = record(value)
    if (!row || typeof row.userId !== 'number' || !Number.isInteger(row.userId) || row.userId <= 0) return
    rows.push({ userId: row.userId, fullName: name(row.userId, row.fullName), reason: reason(row) })
  }
  if (error.code === 'TEAM_CONFLICT_OF_INTEREST' && Array.isArray(error.extra.conflicts)) {
    for (const value of error.extra.conflicts) add(value, row => row.role === 'organizer'
      ? 'เป็นผู้จัดของทัวร์นี้ จึงห้ามเป็นสมาชิกทีมที่สมัคร'
      : row.role === 'referee' ? `เป็นกรรมการของทัวร์นี้ จึงห้ามเป็นสมาชิกทีมที่สมัคร ${refereeInvitationRecovery(row)}`.trim()
        : 'มีบทบาทที่ขัดกับการสมัครทีมในทัวร์นี้')
  } else if (error.code === 'HARD_FILTER_FAILED' && Array.isArray(error.details)) {
    for (const value of error.details) add(value, row => typeof row.reason === 'string'
      ? ruleNames[row.reason] ?? row.reason : 'ไม่ผ่านเงื่อนไขรับสมัคร')
  } else if (error.code === 'PLAYER_NOT_IN_TEAM' && Array.isArray(error.extra.userIds)) {
    for (const userId of error.extra.userIds) add({ userId }, () => 'ไม่ได้เป็นสมาชิกทีมนี้แล้ว กรุณาโหลดรายชื่อใหม่')
  } else if (error.code === 'PLAYER_ALREADY_REGISTERED' && Array.isArray(error.extra.players)) {
    for (const value of error.extra.players) add(value, row => typeof row.teamName === 'string'
      ? `สมัครทัวร์นี้กับทีม ${row.teamName} แล้ว` : 'สมัครทัวร์นี้กับทีมอื่นแล้ว')
  }
  return [...new Map(rows.map(row => [`${row.userId}:${row.reason}`, row])).values()]
}

export const conflictOfInterestDetails = (error: ApiError, members: RegistrationMember[] = []) => {
  if (error.code !== 'TEAM_CONFLICT_OF_INTEREST') return []
  const failures = registrationMemberFailures(error, members)
  return [
    ...(failures.length ? failures.map(row => `${row.fullName} — ${row.reason}`)
      : ['Backend rejected a team role conflict but did not identify the member.']),
    'This rule checks every member of the team, including unchecked players. Deselecting the player does not resolve it. Remove the conflicting team membership or tournament role through an authorized person, or enter another tournament.',
  ]
}
