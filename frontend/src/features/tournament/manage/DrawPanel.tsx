/**
 * src/features/tournament/manage/DrawPanel.tsx
 *
 * The draw, by hand. One select per starting position, pre-filled with the draw
 * as it stands, so rearranging is editing what is there rather than building it
 * again from nothing. Locked the moment the first match starts — a check-in, a
 * recorded score or a kick-off that has come round all count as started.
 *
 * Positions are paired i / size-1-i, the same seeding buildSingle uses, so the
 * pairing shown here is exactly the pairing a submit produces.
 */
import { useState } from 'react'
import { Badge, Panel } from '../../../components/kit/primitives'
import { useLtms } from '../../../shared/store'
import { useDrawTournament } from '../../../hooks/useTournament'
import { matchesOf, team } from '../../../shared/selectors'
import { drawStarted, formatOf } from '../../../shared/rules'
import type { Registration, Tournament } from '../../../shared/types'

export function DrawPanel({ t, approved }: { t: Tournament; approved: Registration[] }) {
  const s = useLtms()
  const draw = useDrawTournament(Number(t.id))
  const ids = approved.map(r => r.team)
  const need = formatOf(t) === 'double' ? 4 : 2

  const first = t.drawn ? matchesOf(s, t.id).filter(m => m.round === 0).sort((a, b) => a.slot - b.slot) : []
  const order: (string | null)[] = []
  first.forEach(m => { order[m.slot * 2] = m.a; order[m.slot * 2 + 1] = m.b })
  const [positions, setPositions] = useState<string[]>(() => ids.map((_, i) => order[i] || ids[i]))

  if (formatOf(t) === 'roundrobin') return null

  if (ids.length < need) {
    return (
      <Panel quiet>
        <span className="tag"><em>//</em> Arrange the draw by hand</span>
        <div className="sub">
          Needs at least {need} approved squads
          {formatOf(t) === 'double' ? ' — double elimination needs a losers bracket to put them in' : ''}.
          {' '}{ids.length} approved so far.
        </div>
      </Panel>
    )
  }

  const started = t.drawn && drawStarted(s, t)
  const size = 1 << Math.ceil(Math.log2(Math.max(2, positions.length)))

  const slot = (i: number) => positions[i] === undefined
    ? <span className="brow"><span className="nm sub">— bye —</span></span>
    : (
      <span className="brow">
        <select
          value={positions[i]}
          aria-label={`Starting position ${i + 1}`}
          style={{ width: '100%', background: 'transparent', border: 0, color: 'inherit', font: 'inherit', fontSize: 15 }}
          onChange={e => setPositions(p => p.map((x, j) => (j === i ? e.target.value : x)))}
        >
          {ids.map(x => <option key={x} value={x}>{team(s, x)?.name ?? x}</option>)}
        </select>
      </span>
    )

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Arrange the draw by hand</span>
        {started ? <Badge kind="neutral">Locked — the tournament has started</Badge>
          : t.drawn ? <Badge kind="warn">Open until the first match starts</Badge>
            : <Badge kind="neutral">Not drawn yet</Badge>}
      </div>
      {started ? null : (
        <>
          <div className="bracket" style={{ padding: '12px 0' }}>
            <div className="bcol">
              {Array.from({ length: size >> 1 }, (_, i) => (
                <div className="bnode" key={i}>
                  <span className="bhead"><span className="tag"><em>//</em> Match {i + 1}</span></span>
                  {slot(i)}
                  {slot(size - 1 - i)}
                </div>
              ))}
            </div>
          </div>
          <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
            onClick={() => draw.mutate({ teamIds: positions.filter(Boolean).map(Number) })}>
            {t.drawn ? 'Save this draw' : 'Draw this way'}
          </button>
        </>
      )}
    </Panel>
  )
}
