import { useNotificationMatch } from '../../hooks/useNotificationMatch'

export function NotificationMatchMessage({ userId, matchId, message }: {
  userId: number; matchId: number; message: string
}) {
  const { match, tournamentName } = useNotificationMatch(userId, matchId)
  if (!match || match.id !== matchId) return <span className="inbox-message">{message}</span>

  const teams = match.teamA || match.teamB
    ? `${match.teamA ?? 'รอระบุทีม'} vs ${match.teamB ?? 'รอระบุทีม'}`
    : null
  const round = match.round !== null ? `รอบ ${match.round}` : null
  const context = [teams, tournamentName, round].filter(Boolean).join(' · ')
  if (!context) return <span className="inbox-message">{message}</span>

  // Replace only this notice's match ID, never unrelated numbers or other match references.
  const reference = new RegExp(`(แมตช์|\\bmatch)\\s*#\\s*${matchId}(?!\\d)`, 'gi')
  const namedMessage = message.replace(reference, (_reference, word: string) => `${word} “${context}”`)
  return <span className="inbox-message">{namedMessage}
    {namedMessage === message ? <span className="inbox-match-context">{context}</span> : null}
  </span>
}
