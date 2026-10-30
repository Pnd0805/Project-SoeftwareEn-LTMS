import { ApiError } from '../../api/client'
import { scheduleErrorKind } from '../../shared/matchScheduleErrors'

/** วงจรชีวิตแมตช์เด้งได้หลายเหตุ — บอกให้ตรงว่าเหตุไหน (R19/R20) */
export const lifecycleError = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : null
  if (code === 'NOT_ORGANIZER') return 'Only the organizer of this tournament can do that.'
  if (code === 'NOT_REFEREE') return 'Only a referee assigned to this match can do that.'
  if (code === 'INVALID_STATUS_TRANSITION') return 'This match has already moved past that step. Reload to see where it stands.'
  if (code === 'INSUFFICIENT_REFEREES') return 'This match needs enough accepted referees before opening check-in or starting. Complete the referee appointments first.'
  if (code === 'INSUFFICIENT_CHECKINS') return 'Both squads are below the minimum number of checked-in players. The match has not started. Wait for more players to check in or ask the organizer to reschedule.'
  if (code === 'CHECKIN_NOT_OPEN') return 'Check-in is not open for this match.'
  if (code === 'MATCH_TEAMS_INCOMPLETE') return 'This match is still waiting on an earlier round for one of its places.'
  if (code === 'TEAMS_PRESENT') return 'Both squads met the minimum, so this is not a no-show — a referee starts it.'
  if (code === 'NOT_MATCH_PARTICIPANT') return 'Only this match’s referees or the organizer can do that.'
  if (code === 'MATCH_NOT_IN_PROGRESS') return 'This match is not being played right now. Reload to see where it stands.'
  if (scheduleErrorKind(error) === 'match') return 'The match schedule is not ready.'
  if (code === 'PREDECESSOR_DISPUTED') return 'An earlier match that feeds this one is still disputed. It has to be settled first.'
  return error instanceof Error ? error.message : 'Something went wrong.'
}
