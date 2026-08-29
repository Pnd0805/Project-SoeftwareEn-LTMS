/**
 * src/features/home/TournamentCard.tsx
 *
 * Organizer is scoped to one tournament and there are many organizers at once,
 * so ownership has to be visible rather than only enforced: the ones you run are
 * pulled out of the list, and every other card names whoever does run it.
 *
 * rel: "run" — yours to manage · "playing" — a squad of yours is in it · null — everyone else's
 */
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/kit/primitives'
import { useLtms } from '../../shared/store'
import { regsOf, team, user } from '../../shared/selectors'
import type { Registration, Tournament } from '../../shared/types'

export type Rel = 'run' | 'playing' | null

export function TournamentCard({ t, rel, entry }: { t: Tournament; rel: Rel; entry?: Registration }) {
  const s = useLtms()
  const navigate = useNavigate()
  const n = regsOf(s, t.id).filter(r => r.status === 'approved').length
  const org = user(s, t.organizer)
  const mine = entry ? team(s, entry.team) : null
  const edge = rel === 'run' ? 'var(--red)' : rel === 'playing' ? 'var(--teal)' : null
  const champion = t.champion ? team(s, t.champion) : null

  const status = t.status === 'public' ? <Badge kind="ok">Public</Badge>
    : t.status === 'private' ? <Badge kind="neutral">Private</Badge>
      : <Badge kind="warn">Pending review</Badge>

  return (
    <button
      className={`panel capsule vstack ${rel ?? ''}`}
      type="button"
      style={{
        gap: 12, textAlign: 'left', border: 0, color: 'inherit',
        ...(edge ? { boxShadow: `var(--sheen),0 0 0 1px ${edge}` } : {}),
      }}
      onClick={() => navigate(`/t/${t.id}${rel === 'run' ? '/manage' : ''}`)}
    >
      <span className="cap" aria-hidden="true"><b>{t.sport}</b></span>
      <span className="spread">{status}<span className="tag">{t.sport}</span></span>
      <span className="disp" style={{ fontSize: 22 }}>{t.name}</span>
      {rel === 'run'
        ? <span className="tag"><em>//</em> You run this</span>
        : rel === 'playing' && mine
          ? (
            <span className="hstack" style={{ gap: 7 }}>
              <span className="tchip"><i style={{ background: mine.color }} /><b>{mine.name}</b></span>
              {entry?.status === 'approved'
                ? <Badge kind="ok">In the draw</Badge>
                : <Badge kind="warn">Waiting on the organizer</Badge>}
            </span>
          )
          : <span className="tag">Run by {org?.name ?? '—'}</span>}
      <span className="spread" style={{ borderTop: '1px solid var(--line)', paddingTop: 11, width: '100%' }}>
        <span className="tag">{n} / {t.cap} teams</span>
        <span className="tag">
          {champion ? `Champion: ${champion.code}` : t.drawn ? 'In progress' : 'Registration open'}
        </span>
      </span>
    </button>
  )
}
