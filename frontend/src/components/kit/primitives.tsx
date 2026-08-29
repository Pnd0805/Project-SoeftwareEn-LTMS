/**
 * src/components/kit/primitives.tsx
 *
 * The shared partials the prototype rendered as template strings. Every class
 * name here is one src/styles/prototype.css already paints — the port keeps the
 * markup and moves only the language it is written in.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { ago, fmtDate, pinHref } from '../../shared/rules'
import type { Match, Pin } from '../../shared/types'

type Kind = 'ok' | 'warn' | 'crit' | 'neutral'

export function Badge({ kind, children }: { kind: Kind; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

/** `// Label` — the mono eyebrow that titles every panel. */
export function Tag({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="tag" style={style}><em>//</em> {children}</span>
}

export function Panel({ quiet, className = '', style, children }: {
  quiet?: boolean; className?: string; style?: CSSProperties; children: ReactNode
}) {
  return <div className={`panel ${quiet ? 'quiet ' : ''}vstack ${className}`.trim()} style={style}>{children}</div>
}

export function Spread({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="spread" style={style}>{children}</div>
}
export function HStack({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="hstack" style={style}>{children}</div>
}
export function VStack({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="vstack" style={style}>{children}</div>
}

/** An empty state says what is missing and how to fix it. */
export function Empty({ icon = 'trophy', title, sub, children }: {
  icon?: IconName; title: string; sub?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <b>{title}</b>
      {sub ? <span className="sub">{sub}</span> : null}
      {children}
    </div>
  )
}

export function Banner({ kind, icon, children }: { kind: Kind; icon?: IconName; children: ReactNode }) {
  return (
    <div className={`banner ${kind}`}>
      <Icon name={icon ?? (kind === 'ok' ? 'check' : kind === 'crit' ? 'warn' : 'warn')} size={16} />
      <span className="grow">{children}</span>
    </div>
  )
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="facts">
      {rows.map(([k, v]) => (
        <div key={k}><span className="k">{k}</span><span className="f">{v}</span></div>
      ))}
    </div>
  )
}

export function Tabs({ tabs, active, onPick }: {
  tabs: { key: string; label: ReactNode }[]
  active: string
  onPick: (key: string) => void
}) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.key} className={`tab ${t.key === active ? 'on' : ''}`} type="button" onClick={() => onPick(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Any page more than one level from a section root gets one, with a Back control. */
export function Crumb({ back, children }: { back: { label: string; onClick: () => void }; children?: ReactNode }) {
  return (
    <div className="crumb">
      <button type="button" onClick={back.onClick}><Icon name="chevL" size={11} /> {back.label}</button>
      {children ? <><span className="sub" aria-hidden="true">/</span><span style={{ color: 'var(--bone)' }}>{children}</span></> : null}
    </div>
  )
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="tblwrap">{children}</div>
}

export type TrailState = 'done' | 'now' | 'idle' | 'bad'
export interface TrailStep { state: TrailState; title: ReactNode; note: ReactNode; cta?: ReactNode }

/** A sequence with one live step — the reader's first question is who it waits on. */
export function Trail({ steps }: { steps: TrailStep[] }) {
  return (
    <div className="trail">
      {steps.map((s, i) => (
        <div className={`st ${s.state}`} key={i}>
          <span className="mk">{s.state === 'done' ? <Icon name="check" size={11} /> : s.state === 'bad' ? '!' : i + 1}</span>
          <span className="bd">
            <span className="ttl">{s.title}{s.state === 'now' ? <Badge kind="warn">Now</Badge> : null}</span>
            <span className="sub">{s.note}</span>
            {s.cta ? <span className="hstack" style={{ marginTop: 4 }}>{s.cta}</span> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

export const FormGuide = ({ form }: { form: string[] }) => (
  <span className="form-guide">{form.slice(-5).map((r, i) => <span className={r} key={i}>{r}</span>)}</span>
)

/** "3h ago" in the text, the exact stamp kept in the title. */
export const When = ({ at }: { at: number | string }) => <span title={fmtDate(at)}>{ago(at)}</span>

/** A venue is a name plus a pin, rendered as a link out — never an embedded map. */
export function VenueLine({ name, pin }: { name?: string | null; pin?: Pin | null }) {
  if (!pin) return <>{name || '—'}</>
  return (
    <a href={pinHref(pin)} target="_blank" rel="noopener" title="Open in Google Maps">
      <Icon name="pin" size={11} /> {name || 'On the map'}
    </a>
  )
}

export function Field({ label, htmlFor, children }: { label: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

export const StatusBadge = ({ m }: { m: Match }) =>
  m.status === 'confirmed' ? <Badge kind="ok">{m.note === 'bye' ? 'Bye' : 'Confirmed'}</Badge>
    : m.status === 'disputed' ? <Badge kind="crit">Disputed</Badge>
      : m.status === 'pending' ? <Badge kind="warn">Awaiting confirmation</Badge>
        : m.a && m.b ? <Badge kind="neutral">Scheduled</Badge>
          : <Badge kind="neutral">Waiting on teams</Badge>

/** The check-in code, drawn rather than fetched — the page has to work offline. */
export function Qr({ size = 19, seed = 7 }: { size?: number; seed?: number }) {
  let r = seed
  const px = 7
  const rand = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const fin = (x: number, y: number) => (x < 7 && y < 7) || (x > size - 8 && y < 7) || (x < 7 && y > size - 8)
  const onFin = (x: number, y: number) => {
    const lx = x < 7 ? x : x - (size - 7), ly = y < 7 ? y : y - (size - 7)
    const d = Math.max(Math.abs(lx - 3), Math.abs(ly - 3))
    return d === 3 || d <= 1
  }
  const rects = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (fin(x, y) ? onFin(x, y) : rand() > 0.52) rects.push(<rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} />)
    }
  }
  return <svg width={size * px} height={size * px} role="img" aria-label="Check-in QR code">{rects}</svg>
}
