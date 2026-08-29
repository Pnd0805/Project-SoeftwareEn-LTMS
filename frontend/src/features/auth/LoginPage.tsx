/**
 * src/features/auth/LoginPage.tsx
 *
 * Pick a role. Every account drives the same demo data, so a reviewer can walk
 * one tournament from five sides without resetting anything. Rendered without
 * the shell — it is the one page that proved a decorative layer can swallow a
 * click, so nothing sits above it.
 */
import { useNavigate } from 'react-router-dom'
import { continueAsGuest, login, resetDemo, useLtms } from '../../shared/store'
import { user } from '../../shared/selectors'
import { Icon } from '../../components/kit/Icon'

const DEMO: [string, string, string][] = [
  ['u-admin', 'Admin', 'Approves tournament requests, manages users and permanent squads'],
  ['u-org', 'Organizer', 'Owns Faculty Football Cup 2026 — approve squads, draw, resolve disputes'],
  ['u-ref', 'Referee', 'Appointed to the Football Cup — check in players, enter results'],
  ['u-lead', 'Team Leader', 'Leads Byte Force — invite players, register, confirm results'],
  ['u-play', 'Player', 'In Byte Force with a pending invite; fails the age rule on purpose'],
]

export function LoginPage() {
  const s = useLtms()
  const navigate = useNavigate()

  const pick = (id: string) => {
    login(id)
    navigate(user(s, id)?.role === 'Admin' ? '/admin' : '/')
  }

  return (
    <div className="auth"><div className="auth-card">
      <div className="hstack" style={{ gap: 11 }}>
        <span style={{ width: 34, height: 34, background: 'var(--red)', display: 'grid', placeItems: 'center', clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)' }}>
          <Icon name="trophy" size={19} />
        </span>
        <span className="disp" style={{ fontSize: 30 }}>LTMS</span>
      </div>
      <div className="sub">
        Local Tournament Management System — working prototype. Pick a role; every account shares the same demo data.
      </div>
      <div className="vstack" style={{ gap: 9 }}>
        {DEMO.map(([id, label, note]) => {
          const u = user(s, id)
          if (!u) return null
          return (
            <button className="who" type="button" key={id} onClick={() => pick(id)}>
              <span className="avatar">{u.name.slice(0, 1)}</span>
              <span className="meta"><b>{label} · {u.name}</b><span className="tag">{note}</span></span>
              <Icon name="chev" size={13} />
            </button>
          )
        })}
      </div>
      <button className="btn ghost" type="button" onClick={() => { continueAsGuest(); navigate('/') }}>
        Continue as guest — browse without signing in
      </button>
      <div className="hstack" style={{ justifyContent: 'space-between' }}>
        <span className="tag"><em>//</em> Data lives in this browser only</span>
        <button className="btn ghost" type="button" onClick={resetDemo}>Reset demo data</button>
      </div>
    </div></div>
  )
}
