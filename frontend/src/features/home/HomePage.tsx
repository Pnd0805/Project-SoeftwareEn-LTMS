/**
 * src/features/home/HomePage.tsx
 *
 * Home stays one column — it is a grid of cards and a rail would only squeeze
 * them. The "Needs you" queue sits at the top, full width, laying its rows out
 * in columns so ten items do not push the grid off the screen. Under it the
 * filter is a sticky toolbar labelled with the live count.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/kit/Icon'
import { Empty, Panel, Tabs } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useLtms } from '../../shared/store'
import { useTournaments } from '../../hooks/useTournament'
import { me, myTeams, regsOf, visibleTo } from '../../shared/selectors'
import { tourLifecycle } from '../../shared/rules'
import type { Registration, Tournament } from '../../shared/types'
import { TournamentCard } from './TournamentCard'
import type { Rel } from './TournamentCard'
import { workQueue } from './workQueue'
import type { WorkEntry, WorkKind } from './workQueue'
import { tournamentView } from '../tournament/tournamentView'

const KIND_COLS: [WorkKind, string][] = [['crit', 'Urgent'], ['warn', 'Waiting'], ['ok', 'Ready']]
const STAGES: [string, string][] = [['', 'All'], ['open', 'Open for entry'], ['competing', 'In progress'], ['finished', 'Finished']]

/**
 * One "Needs you" column is one severity, and one severity can bundle several
 * things across several tournaments — this is where clicking stops guessing
 * which one you meant and lists them all.
 */
function WorkPicker({ kind, entries, onClose }: { kind: WorkKind | null; entries: WorkEntry[]; onClose: () => void }) {
  const navigate = useNavigate()
  const label = KIND_COLS.find(([k]) => k === kind)?.[1] ?? ''
  return (
    <Modal open={!!kind} onClose={onClose} label={label}>
      <div className="vstack" style={{ gap: 14 }}>
        {entries.map((x, i) => (
          <div className="vstack" style={{ gap: 6 }} key={i}>
            <span className="sub"><b style={{ color: 'var(--bone)' }}>{x.what}</b> — {x.where}</span>
            {x.items.map((it, j) => (
              <button className="who" type="button" key={j} onClick={() => { onClose(); navigate(it.href) }}>
                <span className="meta"><b>{it.label}</b>{it.sub ? <span className="tag">{it.sub}</span> : null}</span>
                <Icon name="chev" size={13} />
              </button>
            ))}
          </div>
        ))}
      </div>
      <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
    </Modal>
  )
}

export function HomePage() {
  const s = useLtms()
  const { data: tournamentData, isPending: tournamentsPending } = useTournaments()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const u = me(s)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [openKind, setOpenKind] = useState<WorkKind | null>(null)

  const q = useMemo(() => workQueue(s), [s])
  const all = (tournamentData?.items ?? []).map(tournamentView).filter(t => visibleTo(s, t))
  const needle = query.trim().toLowerCase()
  const textFiltered = needle
    ? all.filter(t => `${t.name} ${t.sport} ${t.venue}`.toLowerCase().includes(needle))
    : all
  const visible = status ? textFiltered.filter(t => tourLifecycle(t) === status) : textFiltered

  /* one tournament sits in one place: running it outranks playing in it */
  const mine = u ? visible.filter(t => t.organizer === u.id) : []
  const squads = myTeams(s).map(x => x.id)
  const entries = new Map<string, Registration>()
  if (u) {
    s.registrations
      .filter(r => squads.includes(r.team) && (r.status === 'approved' || r.status === 'pending'))
      .forEach(r => { if (!entries.has(r.tour)) entries.set(r.tour, r) })
  }
  const playing = visible.filter(t => !mine.includes(t) && entries.has(t.id))
  const open = visible.filter(t => !mine.includes(t) && !playing.includes(t)
    && t.status === 'public' && !t.drawn
    && regsOf(s, t.id).filter(r => r.status === 'approved').length < t.cap)
  const rest = visible.filter(t => !mine.includes(t) && !playing.includes(t) && !open.includes(t)
    && (status || needle || tourLifecycle(t) !== 'finished'))

  const cats: { key: string; label: string; items: Tournament[]; rel: Rel }[] = [
    { key: 'mine', label: `Yours to run · ${mine.length}`, items: mine, rel: 'run' as Rel },
    { key: 'playing', label: `You're competing in · ${playing.length}`, items: playing, rel: 'playing' as Rel },
    { key: 'open', label: `Open for entry · ${open.length}`, items: open, rel: null },
    { key: 'rest', label: `Other tournaments · ${rest.length}`, items: rest, rel: null },
  ].filter(c => c.items.length)
  const tab = cats.find(c => c.key === tabParam) ? tabParam! : cats[0]?.key

  const sports = [...new Set(all.map(t => t.sport))].sort()

  return (
    <>
      {tournamentsPending ? <Panel quiet><span className="sub">Loading tournaments…</span></Panel> : null}
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> University Sports Council · Season 2026</div>
          <h1 className="disp" style={{ fontSize: 36, marginTop: 6 }}>Tournaments</h1>
        </div>
        {u ? (
          <button className="btn primary" type="button" onClick={() => navigate('/request')}>
            <Icon name="plus" size={13} /> Request a tournament
          </button>
        ) : null}
      </div>

      {q.length ? (
        <Panel>
          <div className="spread"><span className="tag"><em>//</em> Needs you · {q.length}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {KIND_COLS.map(([kind, label]) => {
              const n = q.filter(x => x.kind === kind).length
              return (
                <button className="workrow" type="button" key={kind} disabled={!n} onClick={() => setOpenKind(kind)}>
                  <span className={`wk ${kind}`} />
                  <span className="txt"><b>{label}</b><span className="sub">{n} thing{n === 1 ? '' : 's'}</span></span>
                  <Icon name="chev" size={13} />
                </button>
              )
            })}
          </div>
        </Panel>
      ) : null}

      <div className="toolbar">
        <span className="field">
          <label htmlFor="home-find" className="tag">Find one · {visible.length} of {all.length}</label>
          <input id="home-find" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Name, sport or venue…" />
        </span>
        <span className="chips" role="group" aria-label="Filter by sport">
          <button className={`btn pill ${needle ? 'ghost' : 'primary'}`} type="button"
            aria-pressed={!needle} onClick={() => setQuery('')}>All sports</button>
          {sports.map(sp => (
            <button key={sp} type="button" className={`btn pill ${needle === sp.toLowerCase() ? 'primary' : 'ghost'}`}
              aria-pressed={needle === sp.toLowerCase()} onClick={() => setQuery(sp)}>{sp}</button>
          ))}
        </span>
      </div>

      <div className="toolbar" style={{ position: 'static', marginTop: 8 }}>
        <span className="tag">Stage</span>
        <span className="segmented" role="tablist" aria-label="Filter by stage">
          {STAGES.map(([v, lab]) => (
            <button key={v} className={status === v ? 'on' : ''} role="tab" aria-selected={status === v}
              type="button" onClick={() => setStatus(v)}>{lab}</button>
          ))}
        </span>
      </div>

      {needle && !visible.length ? (
        <Empty icon="search" title={`Nothing matched “${query}”`}
          sub="No tournament here has that in its name, sport or venue. Clear the filter, or try the sport on its own.">
          <button className="btn" type="button" onClick={() => setQuery('')}>Clear the filter</button>
        </Empty>
      ) : null}

      {cats.length ? (
        <>
          <Tabs tabs={cats.map(c => ({ key: c.key, label: c.label }))} active={tab!}
            onPick={k => navigate(k === cats[0].key ? '/' : `/home/${k}`)} />
          <div className="grid3">
            {cats.find(c => c.key === tab)!.items.map(t => (
              <TournamentCard key={t.id} t={t} rel={cats.find(c => c.key === tab)!.rel} entry={entries.get(t.id)} />
            ))}
          </div>
        </>
      ) : visible.length ? null : (
        <Empty title="No tournaments yet" sub="Request one to get started." />
      )}

      <WorkPicker kind={openKind} entries={q.filter(x => x.kind === openKind)} onClose={() => setOpenKind(null)} />
    </>
  )
}
