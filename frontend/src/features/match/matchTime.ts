export const matchTime = (value: string | null | undefined) => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value))
}
export const displayTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
