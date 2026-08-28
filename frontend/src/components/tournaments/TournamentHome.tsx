import { Plus, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TournamentCard, type TournamentSummary } from './TournamentCard'
import { WorkQueue } from './WorkQueue'

const tournaments: TournamentSummary[] = [
  { id: 'football-2026', title: 'Faculty Football Cup 2026', sport: 'Football', status: 'Competing', date: '14 Feb 2026', venue: 'Main Stadium', teams: 8, capacity: 8 },
  { id: 'futsal-2026', title: 'Inter-Faculty Futsal 2026', sport: 'Futsal', status: 'Open', date: '08 Mar 2026', venue: 'Indoor Court 1', teams: 8, capacity: 16 },
  { id: 'volleyball-2026', title: 'Engineering Volleyball Cup', sport: 'Volleyball', status: 'Open', date: '01 Mar 2026', venue: 'Gymnasium B', teams: 3, capacity: 8 },
  { id: 'basketball-2026', title: 'Faculty Basketball Showdown', sport: 'Basketball', status: 'Open', date: '14 Mar 2026', venue: 'Gymnasium A', teams: 8, capacity: 8 },
  { id: 'valorant-2025', title: 'Valorant Campus League 2025', sport: 'VALORANT', status: 'Finished', date: '06 Dec 2025', venue: 'Computer Lab 4', teams: 5, capacity: 8 },
]

interface TournamentHomeProps { onRequest: () => void }

export function TournamentHome({ onRequest }: TournamentHomeProps) {
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<'All' | TournamentSummary['status']>('All')
  const filtered = useMemo(() => tournaments.filter((item) => {
    const matchesQuery = `${item.title} ${item.sport} ${item.venue}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (stage === 'All' || item.status === stage)
  }), [query, stage])

  return <div className="page-stack">
    <div className="page-header">
      <div><span className="eyebrow">University Sports Council · Season 2026</span><h1>Tournaments</h1><p>Follow every competition from registration to the final whistle.</p></div>
      <button className="primary-button" type="button" onClick={onRequest}><Plus size={17} /> Request tournament</button>
    </div>
    <WorkQueue />
    <section className="catalog-section" aria-labelledby="catalog-title">
      <div className="catalog-toolbar">
        <div><span className="eyebrow">Competition catalogue</span><h2 id="catalog-title">Browse tournaments</h2></div>
        <div className="toolbar-controls">
          <div className="filter-input"><SlidersHorizontal size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tournaments" aria-label="Filter tournaments" /></div>
          <div className="stage-tabs" role="tablist" aria-label="Tournament stage">
            {(['All', 'Open', 'Competing', 'Finished'] as const).map((value) => <button className={stage === value ? 'stage-active' : ''} key={value} type="button" onClick={() => setStage(value)}>{value}</button>)}
          </div>
        </div>
      </div>
      <div className="tournament-grid">{filtered.map((item, index) => <TournamentCard featured={index === 0 && stage !== 'Finished'} key={item.id} tournament={item} />)}</div>
      {!filtered.length && <div className="empty-state"><h3>No tournaments found</h3><p>Try another sport, venue, or stage.</p></div>}
    </section>
  </div>
}