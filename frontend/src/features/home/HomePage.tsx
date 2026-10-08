import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/kit/Icon'
import { Empty, Panel, Tabs } from '../../components/kit/primitives'
import { useLtms } from '../../shared/store'
import {
  useMyTournamentApplications, useMyTournaments, useTournaments,
} from '../../hooks/useTournament'
import { USE_MOCK } from '../../api/client'
import { me, myTeams, regsOf, visibleTo } from '../../shared/selectors'
import { tourLifecycle } from '../../shared/rules'
import type { Registration, Tournament } from '../../shared/types'
import { TournamentCard } from './TournamentCard'
import type { Rel } from './TournamentCard'
import { workQueue } from './workQueue'
import { buildHomeCategories } from './homeView'
import { tournamentView } from '../tournament/tournamentView'
import { useSportTypes } from '../../hooks/useReference'
import { useMe } from '../../hooks/useAuth'
import { HomeWorkspace } from './HomeWorkspace'
import { useMyMatches } from '../../hooks/useMatch'
import { mockHomeTasks, type HomeTaskFeed } from './homeTasks'
import { RealHomeTasks } from './RealHomeTasks'
import { TournamentPreview } from './TournamentPreview'

const STAGES: [string, string][] = [['', 'All'], ['open', 'Open for entry'], ['competing', 'In progress'], ['finished', 'Finished']]

function previewDate(value: string | null | undefined) {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available'
    : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function accessDenied(query: { isError: boolean; error?: unknown }) {
  const status = (query.error as { status?: unknown } | null)?.status
  return query.isError && (status === 401 || status === 403)
}

function MockHomeWorkspace({ feeds }: { feeds: readonly HomeTaskFeed[] }) {
  const matches = useMyMatches()
  return <HomeWorkspace feeds={feeds} matches={matches} />
}

export function HomePage() {
  const s = useLtms()
  const auth = useMe()
  const currentUser = accessDenied(auth) ? undefined : auth.data
  const { data: tournamentData, isPending: apiPending, isError: apiError, error: tournamentError,
    isFetching: tournamentsFetching, refetch: retryTournaments } = useTournaments()
  const myTournaments = useMyTournaments(!!currentUser)
  const myApplications = useMyTournamentApplications(!!currentUser)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { tab: tabParam } = useParams()
  const u = USE_MOCK ? me(s) : undefined
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  const q = useMemo(() => USE_MOCK ? workQueue(s) : [], [s])
  const signedIn = USE_MOCK ? !!u : !!currentUser
  const homeDestination = location.pathname === '/'
  const taskFeeds = useMemo<HomeTaskFeed[]>(() => USE_MOCK ? [{
    source: 'mock',
    label: 'Your tasks',
    state: 'ready',
    tasks: mockHomeTasks(q),
    retry: () => {},
  }] : [], [q])
  /* รายการทัวร์นาเมนต์ยังรอ backend (FEAT-1-REMAINING: backend blockers) — โหมด mock อ่าน seed
     ใน store ที่หน้าอื่นทุกหน้าอ่านอยู่ ไม่ใช่ fixture ของ api/tournament.ts ซึ่งมีรายการเดียว */
  const tournamentsPending = !USE_MOCK && apiPending
  /* ชื่อกีฬามาจาก backend — id ของกีฬาเคยถูก renumber มาแล้ว (migration 010) */
  const sportTypes = useSportTypes()
  /* TanStack เก็บข้อมูลเก่าไว้เมื่อ refetch ล้มเหลว จึงต้องตัด cache ที่ถูกปฏิเสธสิทธิ์ก่อนใช้ */
  const publicDenied = accessDenied({ isError: apiError, error: tournamentError })
  const mineDenied = accessDenied(myTournaments)
  const publicDtos = publicDenied ? [] : tournamentData?.items ?? []
  const mineDtos = currentUser && !mineDenied ? myTournaments.data?.items ?? [] : []
  const permittedDtos = [...publicDtos, ...mineDtos]
    .filter((dto, index, allDtos) => allDtos.findIndex(candidate => candidate.id === dto.id) === index)
  /* รายการของเราที่ไม่ได้อยู่ในลิสต์สาธารณะ (private หลังเพิ่งผ่าน admin หรือจบไปแล้ว)
     ต้องตามไปขอ detail มาเอง ไม่งั้น "Yours to run" กรองจาก visible แล้วไม่เหลืออะไร
     เพราะของเราไม่เคยอยู่ใน visible ตั้งแต่แรก */
  const source = USE_MOCK ? s.tournaments
    : permittedDtos.map(dto => tournamentView(dto, [], [], sportTypes.data?.items ?? []))
  const all = USE_MOCK ? source.filter(t => visibleTo(s, t)) : source
  const needle = query.trim().toLowerCase()
  const textFiltered = needle
    ? all.filter(t => `${t.name} ${t.sport} ${t.venue}`.toLowerCase().includes(needle))
    : all
  const visible = status ? textFiltered.filter(t => tourLifecycle(t) === status) : textFiltered

  /* Relationship buckets depend on prototype-only registrations. In real mode
     the list is server-owned, so never infer them from stale `ltms.v1` data. */
  const entries = new Map<string, Registration>()
  let cats: { key: string; label: string; items: Tournament[]; rel: Rel }[]
  if (USE_MOCK) {
    const mine = u ? visible.filter(t => t.organizer === u.id) : []
    const squads = myTeams(s).map(x => x.id)
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
    cats = [
      { key: 'mine', label: `Yours to run · ${mine.length}`, items: mine, rel: 'run' as Rel },
      { key: 'playing', label: `You're competing in · ${playing.length}`, items: playing, rel: 'playing' as Rel },
      { key: 'open', label: `Open for entry · ${open.length}`, items: open, rel: null },
      { key: 'rest', label: `Other tournaments · ${rest.length}`, items: rest, rel: null },
    ].filter(c => c.items.length)
  } else {
    /* โหมดจริง — รายการสาธารณะไม่ได้บอกว่าใครเป็นผู้จัดหรือทีมเราสมัครไว้ไหม
       จึงถามจากฝั่งตัวเอง: /me/tournament-requests (ของที่เราขอจัด) และ /me/applications
       แล้วค่อยจับคู่ด้วย id — ไม่ได้เดาจาก store ที่ค้างอยู่ในเครื่อง */
    const mineIds = new Set(mineDtos.map(r => String(r.id)))
    const playingIds = new Set(
      (myApplications.data?.items ?? [])
        .filter(a => a.status === 'approved' || a.status === 'pending')
        .map(a => String(a.tournament.id)),
    )
    const openIds = new Set(
      publicDtos.filter(dto => dto.registrationOpen).map(dto => String(dto.id)),
    )
    const mine = visible.filter(t => mineIds.has(t.id))
    const playing = visible.filter(t => !mineIds.has(t.id) && playingIds.has(t.id))
    const open = visible.filter(t => !mineIds.has(t.id) && !playingIds.has(t.id) && openIds.has(t.id))
    const rest = visible.filter(t => !mineIds.has(t.id) && !playingIds.has(t.id) && !openIds.has(t.id))
    cats = [
      { key: 'mine', label: `Yours to run · ${mine.length}`, items: mine, rel: 'run' as Rel },
      { key: 'playing', label: `You're competing in · ${playing.length}`, items: playing, rel: 'playing' as Rel },
      { key: 'open', label: `Open for entry · ${open.length}`, items: open, rel: null },
      { key: 'rest', label: `Other tournaments · ${rest.length}`, items: rest, rel: null },
    ].filter(c => c.items.length)
  }
  const idsIn = (key: string) => new Set(cats.find(category => category.key === key)?.items.map(t => t.id) ?? [])
  const categorized = buildHomeCategories(visible, idsIn('mine'), idsIn('playing'), idsIn('open'))
  cats = categorized.categories
  const tab = cats.find(c => c.key === tabParam) ? tabParam! : 'all'

  const sports = [...new Set(all.map(t => t.sport))].sort()
  const preview = all.find(t => t.id === searchParams.get('preview'))
  const previewDto = permittedDtos.find(dto => String(dto.id) === preview?.id)
  const previewMine = USE_MOCK ? !!u && preview?.organizer === u.id
    : mineDtos.some(dto => String(dto.id) === preview?.id)
  /* ค่า default ของ tournamentView มีไว้ให้หน้ารวมแสดงผล ไม่ใช่หลักฐานของข้อมูลใน popup */
  const previewCapacity = USE_MOCK ? preview?.cap : previewDto?.maxTeams
  const previewStatus = USE_MOCK ? preview?.status : previewDto?.status
  const previewEntry = USE_MOCK ? preview?.registrationOpen : previewDto?.registrationOpen
  const previewFacts = [
    { label: 'Venue', value: (USE_MOCK ? preview?.venue : previewDto?.venue) || 'Not available' },
    { label: 'Starts', value: previewDate(USE_MOCK ? preview?.date : previewDto?.eventStartDate) },
    { label: 'Capacity', value: typeof previewCapacity === 'number' && Number.isFinite(previewCapacity) && previewCapacity > 0
      ? `${previewCapacity} teams` : 'Not available' },
    { label: 'Visibility', value: previewStatus === 'public' ? 'Public' : previewStatus === 'private' ? 'Private' : 'Not available' },
    { label: 'Phase', value: previewStatus === 'completed' ? 'Completed' : previewStatus === 'pending' || previewStatus === 'pending_approval' ? 'Pending review' : 'Not available' },
    { label: 'Entry', value: previewEntry === true ? 'Open' : previewEntry === false ? 'Closed' : 'Not available' },
  ].filter(fact => fact.value !== 'Not available')
  const previewSport = USE_MOCK ? preview?.sport : sportTypes.data?.items.find(sport => sport.id === previewDto?.sportTypeId)?.name
  const selectPreview = (id: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('preview', id)
    else next.delete('preview')
    setSearchParams(next, { replace: id === null })
  }
  const previewSourcesResolved = USE_MOCK || (!auth.isPending
    && (publicDenied || (!!tournamentData && !tournamentsFetching))
    && (!currentUser || mineDenied || (!!myTournaments.data && !myTournaments.isFetching)))
  useEffect(() => {
    if (!searchParams.has('preview') || preview || !previewSourcesResolved) return
    const next = new URLSearchParams(searchParams)
    next.delete('preview')
    setSearchParams(next, { replace: true })
  }, [preview, previewSourcesResolved, searchParams, setSearchParams])

  return (
    <>
      {signedIn && homeDestination ? (
        <div className="spread home-page-title">
          <h1 className="disp" style={{ fontSize: 36, marginTop: 0 }}>Home</h1>
          <button className="btn primary" type="button" onClick={() => navigate('/request')}>
            <Icon name="plus" size={13} /> Request tournament
          </button>
        </div>
      ) : null}
      {signedIn && homeDestination && USE_MOCK ? <MockHomeWorkspace feeds={taskFeeds} /> : null}
      {signedIn && homeDestination && !USE_MOCK ? <RealHomeTasks /> : null}
      {signedIn && homeDestination
        ? <h2 id="tournaments" className="disp tournament-destination-title" style={{ fontSize: 30, marginTop: 0 }}>Tournaments</h2>
        : <h1 id="tournaments" className="disp tournament-destination-title" style={{ fontSize: 36, marginTop: 0 }}>Tournaments</h1>}
      {tournamentsPending ? <Panel quiet><span className="sub" role="status">Loading tournaments…</span></Panel> : null}
      {!USE_MOCK && apiError ? (
        <div className="spread home-source-error" role="alert">
          <span>Unable to load tournaments</span>
          <button className="btn" type="button" aria-label="Retry tournaments" onClick={() => { void retryTournaments() }}>Retry</button>
        </div>
      ) : null}

      <div className="toolbar home-toolbar">
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

      <div className="toolbar home-toolbar home-stage" style={{ position: 'static', marginTop: 8 }}>
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
          <div className="home-category-tabs">
            <Tabs tabs={cats.map(c => ({ key: c.key, label: c.label }))} active={tab!}
              onPick={k => navigate(`/home/${k}${location.search}`)} />
          </div>
          <div className="grid3">
            {cats.find(c => c.key === tab)!.items.map(t => (
              <TournamentCard key={t.id} t={t}
                rel={tab === 'all' ? categorized.relations.get(t.id) ?? null : cats.find(c => c.key === tab)!.rel}
                entry={entries.get(t.id)} onPreview={() => selectPreview(t.id)} />
            ))}
          </div>
        </>
      ) : visible.length || tournamentsPending || (!USE_MOCK && apiError) ? null : (
        <Empty title="No tournaments yet" sub={signedIn ? 'Request one to get started.' : 'Check back for upcoming tournaments.'} />
      )}
      <TournamentPreview open={!!preview} name={preview?.name ?? ''} sport={previewSport ?? 'Sport not available'}
        facts={previewFacts} href={`/t/${preview?.id}${previewMine ? '/manage' : ''}`}
        onClose={() => selectPreview(null)} />
    </>
  )
}
