import { fmtDateTime } from '../../shared/dateFormat'
export const matchTime = (value: string | null | undefined) => fmtDateTime(value)
export const displayTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
