/**
 * src/components/kit/chips.tsx
 *
 * A squad reads as its badge plus its name everywhere it appears. `TeamChip` is
 * the flat one — safe inside a <button>; `TeamLink` opens the squad's page and
 * must never be nested inside another button.
 */
import { Link } from 'react-router-dom'
import { useLtms } from '../../shared/store'
import { team, user } from '../../shared/selectors'
import type { Team } from '../../shared/types'

export function TeamMark({ t }: { t: Team }) {
  return t.logo
    ? <img src={t.logo} alt="" width={16} height={16} style={{ borderRadius: 4, objectFit: 'cover', flex: '0 0 auto' }} />
    : <i style={{ background: t.color }} />
}

export function TeamChip({ id }: { id?: string | null }) {
  const s = useLtms()
  const t = team(s, id)
  if (!t) return <span className="sub">TBD</span>
  return <span className="tchip"><TeamMark t={t} />{t.name}</span>
}

export function TeamLink({ id }: { id?: string | null }) {
  const s = useLtms()
  const t = team(s, id)
  if (!t) return <span className="sub">TBD</span>
  return (
    <Link className="tchip link" to={`/team/${t.id}`} title={`Open ${t.name}`}>
      <TeamMark t={t} /><span>{t.name}</span>
    </Link>
  )
}

export function PlayerLink({ id }: { id?: string | null }) {
  const s = useLtms()
  const u = user(s, id)
  if (!u) return <span className="sub">—</span>
  return <Link className="tchip link" to={`/player/${u.id}`}><span>{u.name}</span></Link>
}

export function Avatar({ name, style }: { name?: string; style?: React.CSSProperties }) {
  return <span className="avatar" style={style}>{(name || '?').slice(0, 1)}</span>
}
