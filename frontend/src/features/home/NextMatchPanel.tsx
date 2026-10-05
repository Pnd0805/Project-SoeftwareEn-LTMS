import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MatchListItemDto } from '../../types/match.dto'

export type UpcomingMatch = Pick<MatchListItemDto, 'id' | 'status' | 'scheduledTime' | 'venue'> & {
  teamA: { name: string } | null
  teamB: { name: string } | null
  tournament: { name: string }
}

export function NextMatchPanel({ matches, pending, failed, onRetry }: {
  matches: readonly UpcomingMatch[]
  pending: boolean
  failed: boolean
  onRetry: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // ต้องมีเวลาและคู่แข่งจริงก่อนเรียกว่าแมตช์ถัดไป ไม่ใช้วันที่หรือชื่อจากค่าเริ่มต้น
  const next = matches.filter(match =>
    (match.status === 'scheduled' || match.status === 'checkin_open')
    && match.teamA?.name.trim() && match.teamB?.name.trim()
    && match.scheduledTime && Date.parse(match.scheduledTime) >= now,
  ).sort((a, b) => Date.parse(a.scheduledTime!) - Date.parse(b.scheduledTime!))[0]

  return (
    <section className="home-next-match" aria-labelledby="home-next-heading" aria-busy={pending}>
      <h2 id="home-next-heading" className="h-sec">Next match</h2>
      <div className="home-next-body">
        {pending ? <p className="sub" role="status">Loading next match…</p> : null}
        {failed ? <div className="spread" role="alert">
          <span>Unable to load matches</span>
          <button className="btn" type="button" aria-label="Retry matches" onClick={onRetry}>Retry</button>
        </div> : null}
        {next ? <>
          {next.tournament.name ? <p className="home-next-tournament">{next.tournament.name}</p> : null}
          <div className="home-next-teams">
            <h3 className="disp">{next.teamA!.name}</h3>
            <span className="sub">vs</span>
            <h3 className="disp">{next.teamB!.name}</h3>
          </div>
          <div className="home-next-details">
            <time dateTime={next.scheduledTime!}>{new Intl.DateTimeFormat('en', {
              month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
            }).format(new Date(next.scheduledTime!))}</time>
            <span className="sub">{next.venue?.trim() || 'Venue not set'}</span>
          </div>
          <Link className="btn primary" to={`/m/${next.id}`}>View match</Link>
        </> : !pending && !failed ? <>
          <p className="home-next-empty" role="status">No scheduled match</p>
          <p className="sub">Your next confirmed match will appear here.</p>
          <Link className="btn" to="/matches">View matches</Link>
        </> : null}
      </div>
    </section>
  )
}
