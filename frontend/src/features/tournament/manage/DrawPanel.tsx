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
import { ConfirmCard, Modal } from '../../../components/kit/Modal'
import { useLtms } from '../../../shared/store'
import { useDrawTournament, useTournamentTeams } from '../../../hooks/useTournament'
import { useTournamentMatches } from '../../../hooks/useMatch'
import { matchesOf, regsOf, team } from '../../../shared/selectors'
import { drawStarted, formatOf } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'
import { checkDraw } from '../../match/resultRules'

/** ทีมหนึ่งทีมในสายจับ — id เก็บเป็น string เสมอเพื่อให้ <select> เทียบค่าได้ */
interface Entry { id: string; name: string; ref: number | string }

export function DrawPanel({ t }: { t: Tournament }) {
  const s = useLtms()
  const tournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  /**
   * ทีมที่ได้ที่นั่งมาจาก GET /tournaments/:id/teams
   *
   * ⚠️ เดิมอ่านจาก `detail.applications` ของ GET /tournaments/:id ซึ่ง **backend ไม่ได้ส่งมา**
   *    (detail มีแค่ organizer กับ approvedTeamCount) — ค่าเป็น undefined แล้ว .filter พังทั้งหน้า
   */
  const approvedTeams = useTournamentTeams(tournamentId)
  const tournamentMatches = useTournamentMatches(tournamentId)
  const live = tournamentId !== undefined
  /* ชั้น API รับได้ทั้งสอง ref จึงส่งตัวที่หน้าถืออยู่ */
  const draw = useDrawTournament(tournamentId ?? t.id)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const entries: Entry[] = live
    ? (approvedTeams.data?.items ?? [])
        .map(team => ({ id: String(team.id), name: team.name, ref: team.id }))
    : regsOf(s, t.id)
        .filter(r => r.status === 'approved')
        .map(r => ({ id: r.team, name: team(s, r.team)?.name ?? r.team, ref: r.team }))

  const ids = entries.map(e => e.id)
  const need = formatOf(t) === 'double' ? 4 : 2

  /* สายที่จับไว้แล้ว — รอบแรกเรียงตามช่อง เพื่อให้ค่าเริ่มต้นคือของเดิม ไม่ใช่ของใหม่ */
  const order: (string | null)[] = []
  if (live) {
    const drawnFirstRound = (tournamentMatches.data?.items ?? [])
      .filter(m => m.roundNumber === 1)
      .sort((a, b) => a.id - b.id)
    drawnFirstRound.forEach((m, i) => {
      order[i * 2] = m.teamA ? String(m.teamA.id) : null
      order[i * 2 + 1] = m.teamB ? String(m.teamB.id) : null
    })
  } else {
    const first = t.drawn ? matchesOf(s, t.id).filter(m => m.round === 0).sort((a, b) => a.slot - b.slot) : []
    first.forEach(m => { order[m.slot * 2] = m.a; order[m.slot * 2 + 1] = m.b })
  }
  const [positions, setPositions] = useState<string[]>(() => ids.map((_, i) => order[i] || ids[i]))
  const entryKey = ids.join('|')
  const orderKey = order.map(id => id ?? '').join('|')
  const sourceKey = `${entryKey}::${orderKey}`
  const [positionSource, setPositionSource] = useState(sourceKey)

  /* Queries are empty on the first render. Reconcile during render when their
     source changes so the editor never opens with the stale empty snapshot. */
  if (positionSource !== sourceKey) {
    const valid = new Set(ids)
    const preferred = order.filter((id): id is string => !!id && valid.has(id))
    const retained = positions.filter((id, index) => valid.has(id) && positions.indexOf(id) === index)
    const next = [...(preferred.length ? preferred : retained)]
    ids.forEach(id => { if (!next.includes(id)) next.push(id) })
    setPositionSource(sourceKey)
    setPositions(next)
  }

  if (formatOf(t) === 'roundrobin') return null

  if (live && approvedTeams.isPending) {
    return <Panel quiet><span className="sub">Loading the squads that got in…</span></Panel>
  }

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

  /* ล็อกเมื่อแมตช์แรกเริ่มเดินแล้ว — โหมดจริงดูจากสถานะแมตช์ ไม่ใช่ store */
  const liveStarted = live && (tournamentMatches.data?.items ?? [])
    .some(m => m.status !== 'scheduled')
  const started = live ? liveStarted : (t.drawn && drawStarted(s, t))
  const alreadyDrawn = live ? (tournamentMatches.data?.items.length ?? 0) > 0 : t.drawn
  const replacementUnavailable = live && alreadyDrawn && started
  const size = 1 << Math.ceil(Math.log2(Math.max(2, positions.length)))
  const byId = new Map(entries.map(e => [e.id, e]))

  const slot = (i: number) => positions[i] === undefined
    ? <span className="brow"><span className="nm sub">— bye —</span></span>
    : (
      <span className="brow">
        <select
          value={positions[i]}
          aria-label={`Starting position ${i + 1}`}
          disabled={replacementUnavailable || draw.isPending}
          style={{ width: '100%', background: 'transparent', border: 0, color: 'inherit', font: 'inherit', fontSize: 15 }}
          onChange={e => setPositions(p => p.map((x, j) => (j === i ? e.target.value : x)))}
        >
          {entries.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </span>
    )

  /* ทีมเดียวกันลงสองช่องไม่ได้ — ตรวจสดขณะเลือก ไม่ใช่ตอนกดส่ง */
  const drawProblems = checkDraw(positions, id => byId.get(id)?.name ?? id)

  const submit = () => {
    if (drawProblems.length) return
    const teamIds = positions
      .map(id => byId.get(id)?.ref)
      .filter((n): n is number | string => n !== undefined)
    if (!teamIds.length) return
    if (live && alreadyDrawn) {
      setConfirmReplace(true)
      return
    }
    draw.mutate({ teamIds: teamIds as number[] })
  }

  const replace = () => {
    const teamIds = positions
      .map(id => byId.get(id)?.ref)
      .filter((n): n is number => typeof n === 'number')
    if (!teamIds.length) return
    setConfirmReplace(false)
    draw.mutate({ teamIds, replace: true })
  }

  const bracketInUseMatches = (() => {
    if (!draw.isError || typeof draw.error !== 'object' || draw.error === null || !('extra' in draw.error)) return []
    const matches = (draw.error as { extra?: { matches?: unknown } }).extra?.matches
    return Array.isArray(matches) ? matches as Array<{ id?: number; status?: string; checkins?: number; results?: number }> : []
  })()
  const errorCode = draw.isError && typeof draw.error === 'object' && draw.error !== null && 'code' in draw.error
    ? String((draw.error as { code?: unknown }).code ?? '') : ''

  return (
    <Panel quiet>
      <Modal open={confirmReplace} onClose={() => setConfirmReplace(false)}
        label="Redraw the bracket" title={t.name}>
        <ConfirmCard danger ok="Redraw now" onCancel={() => setConfirmReplace(false)} onConfirm={replace}
          body={<>
            <b>This replaces every existing match atomically.</b> Schedules, match-specific referees,
            referee transfer requests and standings will be removed and rebuilt from the currently
            approved squads. Tournament-level referee pool members stay, but you must assign referees
            to the new matches again.
          </>} />
      </Modal>
      <div className="spread">
        <span className="tag"><em>//</em> Arrange the draw by hand</span>
        {started ? <Badge kind="neutral">Locked — the tournament has started</Badge>
          : replacementUnavailable ? <Badge kind="warn">Redraw unavailable</Badge>
            : alreadyDrawn ? <Badge kind="warn">Open until the first match starts</Badge>
            : <Badge kind="neutral">Not drawn yet</Badge>}
      </div>

      {replacementUnavailable ? (
        <Banner kind="warn">
          <b>This bracket is already in use.</b> A redraw is available only while every match is still scheduled
          and has no check-ins or results.
        </Banner>
      ) : null}

      {drawProblems.length ? (
        <Banner kind="crit">
          <b>สายนี้ยังส่งไม่ได้</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {drawProblems.map(p => <li key={p}>{p}</li>)}
          </ul>
        </Banner>
      ) : null}

      {draw.isError ? (
        <Banner kind="crit">
          <b>จับสายไม่สำเร็จ</b> {(draw.error as Error).message}
          {errorCode === 'BRACKET_IN_USE' ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {bracketInUseMatches.map((match, index) => (
                <li key={match.id ?? index}>
                  Match #{match.id ?? '?'} · {match.status ?? 'unknown status'} · {match.checkins ?? 0} check-ins · {match.results ?? 0} results
                </li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}

      {draw.isSuccess && draw.data.bracket?.replaced ? (
        <Banner kind="ok" icon="check">
          <b>The bracket was redrawn.</b> Assign referees to every new match before play starts.
        </Banner>
      ) : null}

      {draw.isPending ? (
        <Banner kind="neutral"><b>Drawing the bracket…</b> Waiting for the saved matches to refresh.</Banner>
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
          {replacementUnavailable ? null : (
            <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
              disabled={draw.isPending || drawProblems.length > 0}
              onClick={submit}>
              {draw.isPending ? 'Drawing…' : alreadyDrawn ? 'Redraw bracket' : 'Draw this way'}
            </button>
          )}
        </>
      )}
    </Panel>
  )
}
