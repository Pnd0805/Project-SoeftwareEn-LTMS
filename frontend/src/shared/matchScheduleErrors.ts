import { ApiError } from '../api/client'

export const scheduleFieldLabels = {
  scheduledTime: 'Kick-off',
  scheduledEndTime: 'End',
  venue: 'Venue',
} as const
export type ScheduleField = keyof typeof scheduleFieldLabels

/** Distinguish an incomplete request from an unscheduled match without parsing messages. */
export function scheduleErrorKind(error: unknown): 'request' | 'match' | null {
  if (!(error instanceof ApiError)) return null
  if (error.status === 400 && error.code === 'SCHEDULE_INCOMPLETE') return 'request'
  // Keep legacy 409 support while an older backend process may still be running.
  if (error.status === 409 && (error.code === 'MATCH_NOT_SCHEDULED' || error.code === 'SCHEDULE_INCOMPLETE')) return 'match'
  return null
}

export function missingScheduleFields(error: unknown): ScheduleField[] {
  if (!scheduleErrorKind(error) || !(error instanceof ApiError) || !Array.isArray(error.extra.missing)) return []
  return [...new Set(error.extra.missing.filter((value): value is ScheduleField =>
    typeof value === 'string' && Object.hasOwn(scheduleFieldLabels, value)))]
}
