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
 *
 * ── ทีมที่ลงแข่งมาจากไหน ──────────────────────────────────────────────────
 * เดิมรับ `approved: Registration[]` จาก ManageTab ซึ่งอ่านจาก store เสมอ แปลว่า
 * ทัวร์นาเมนต์ที่มาจาก API จะได้อาร์เรย์ว่างตลอด ตอนนี้พาเนลหาเองจากแหล่งเดียวกับ
 * RegistrationsPanel — id ตัวเลขใช้ applications จาก API · id string ใช้ store
 *
 * ปุ่มส่งผลจับสายทำงานได้ทั้งสองทาง — ชั้น API รับ ref ทั้ง id ตัวเลขและ id ของ
 * store แล้วเขียนกลับ store ผ่าน `drawBracket` เดิม (mocks/tournamentWrites.ts)
 * โค้ดก่อนหน้านี้ส่ง `positions.map(Number)` โดยที่ positions เป็น id ของ store
 * ('tm-3') ผลคืออาร์เรย์ของ NaN ทั้งชุด
 */
import { useState } from 'react'
import { Badge, Banner, Panel } from '../../../components/kit/primitives'
import { useLtms } from '../../../shared/store'
import { useDrawTournament, useTournament } from '../../../hooks/useTournament'
import { matchesOf, regsOf, team } from '../../../shared/selectors'
import { drawStarted, formatOf } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'

/** ทีมหนึ่งทีมในสายจับ — id เก็บเป็น string เสมอเพื่อให้ <select> เทียบค่าได้ */
interface Entry { id: string; name: string; ref: number | string }

export function DrawPanel({ t }: { t: Tournament }) {
  const s = useLtms()
  const tournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const { data: detail } = useTournament(tournamentId)
  const live = tournamentId !== undefined && !!detail
  /* ชั้น API รับได้ทั้งสอง ref จึงส่งตัวที่หน้าถืออยู่ */
  const draw = useDrawTournament(tournamentId ?? t.id)

  const entries: Entry[] = live
    ? detail.applications
        .filter(a => a.status === 'approved')
        .map(a => ({ id: String(a.teamId), name: a.team.name, ref: a.teamId }))
    : regsOf(s, t.id)
        .filter(r => r.status === 'approved')
        .map(r => ({ id: r.team, name: team(s, r.team)?.name ?? r.team, ref: r.team }))

  const ids = entries.map(e => e.id)
  const need = formatOf(t) === 'double' ? 4 : 2

  /* สายที่จับไว้แล้ว — รอบแรกเรียงตามช่อง เพื่อให้ค่าเริ่มต้นคือของเดิม ไม่ใช่ของใหม่ */
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
  const byId = new Map(entries.map(e => [e.id, e]))

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
          {entries.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </span>
    )

  const submit = () => {
    const teamIds = positions
      .map(id => byId.get(id)?.ref)
      .filter((n): n is number | string => n !== undefined)
    if (teamIds.length) draw.mutate({ teamIds: teamIds as number[] })
  }

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Arrange the draw by hand</span>
        {started ? <Badge kind="neutral">Locked — the tournament has started</Badge>
          : t.drawn ? <Badge kind="warn">Open until the first match starts</Badge>
            : <Badge kind="neutral">Not drawn yet</Badge>}
      </div>

      {draw.isError ? (
        <Banner kind="crit"><b>จับสายไม่สำเร็จ</b> {(draw.error as Error).message}</Banner>
      ) : null}

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
            disabled={draw.isPending}
            onClick={submit}>
            {t.drawn ? 'Save this draw' : 'Draw this way'}
          </button>
        </>
      )}
    </Panel>
  )
}
