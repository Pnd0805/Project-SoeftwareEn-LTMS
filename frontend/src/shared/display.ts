export function displayDate(value: string | null | undefined): string {
  if (!value) return 'Not specified'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(date) : 'Not specified'
}
export const dateRange = (start: string, end?: string | null) => !end || end.slice(0, 10) === start.slice(0, 10) ? displayDate(start) : `${displayDate(start)} – ${displayDate(end)}`
export const statusLabel = (value: string) => ({ public: 'Public', private: 'Private', pending_approval: 'Pending review', completed: 'Finished', university_wide: 'University Admin', root: 'Root', faculty: 'Faculty Admin' }[value] ?? value.replaceAll('_', ' ').replace(/^./, s => s.toUpperCase()))
export const searchUserLabel = (user: { id: number; facultyName?: string | null; year?: number | null }) =>
  [`Player #${user.id}`, user.facultyName, user.year == null ? null : `Year ${user.year}`].filter(Boolean).join(' · ')
