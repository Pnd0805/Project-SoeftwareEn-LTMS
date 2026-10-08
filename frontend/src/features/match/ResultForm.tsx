/**
 * src/features/match/ResultForm.tsx
 *
 * Every submitted score is final and must identify a winner. If regulation
 * play is level, officials finish the tiebreak on the field and enter the
 * resulting aggregate score here.
 *
 * SRS FR-RS-01: บันทึกคะแนน ผู้ชนะ และสถิติรายบุคคลตามประเภทกีฬา
 *
 * ── ย้ายมาใช้ API แล้ว ─────────────────────────────────────────────────────
 * ช่องสถิติมาจาก `sport_stat_definitions` ผ่าน `useStatDefinitions()` ไม่ใช่
 * `statLabels(t.sport)` ที่ hardcode ตามชื่อกีฬาใน rules.ts อีกต่อไป — เพิ่มกีฬา
 * ใหม่แล้วฟอร์มขึ้นเองโดยไม่ต้องแก้โค้ด ซึ่งเป็นเหตุผลที่ตารางนั้นมีอยู่
 *
 * S01 เป็น idempotent อยู่แล้ว (match_results.match_id เป็น UNIQUE) กดซ้ำจึง
 * UPDATE แถวเดิม ไม่สร้างซ้ำ — ปุ่มไม่ต้องกันการกดซ้ำเอง
 */
import { useRef, useState } from 'react'
import { Modal } from '../../components/kit/Modal'
import { useMatchActive } from './MatchActivity'
import { Banner, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamChipView } from '../../components/kit/chips'
import { useStatDefinitions, useSubmitResult, useSaveMatchStats } from '../../hooks/useMatch'
import { toTeamView } from './matchView'
import { checkResult } from './resultRules'
import type { MatchDto, MatchTeamRef } from '../../types/match.dto'

type Nums = Record<string, number>

export function ResultForm({ m, visible = true }: { m: MatchDto; visible?: boolean }) {
  const { data: defs } = useStatDefinitions(m.tournament.sportTypeId)
  const submit = useSubmitResult(m.id, m.tournamentId)
  const saveStats = useSaveMatchStats(m.id)

  const [sa, setSa] = useState(0)
  const [sb, setSb] = useState(0)
  const [stat, setStat] = useState<Nums>({})
  const [teamFilter, setTeamFilter] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'partial' | 'success'; text: string } | null>(null)
  const active = useMatchActive()
  const submitting = useRef(false)
  const busy = saving || submit.isPending || saveStats.isPending


  const sides = [m.teamA, m.teamB].filter(Boolean) as MatchTeamRef[]
  const statDefs = defs?.items ?? []
  const players = sides.flatMap(team => team.players.map(player => ({ team, player })))
  const visiblePlayers = players.filter(({ team, player }) => (!teamFilter || String(team.id) === teamFilter)
    && player.fullName.toLocaleLowerCase().includes(playerSearch.trim().toLocaleLowerCase()))
  const level = sa === sb

  const key = (playerId: number, statKey: string) => `${playerId}:${statKey}`
  const num = (playerId: number, statKey: string, label: string) => (
    <input id={`stat-${playerId}-${statKey}`} aria-label={label} type="number" min={0} max={999} disabled={busy} style={{ width: 74 }}
      value={stat[key(playerId, statKey)] ?? 0}
      onChange={e => setStat(p => ({ ...p, [key(playerId, statKey)]: Number(e.target.value) }))} />
  )

  const winnerTeamId = () => sa > sb ? m.teamA?.id ?? null : m.teamB?.id ?? null

  /* สกอร์กับสถิติเป็นคนละ request และไม่ใช่ธุรกรรมเดียวกัน — ถ้าอันหลังพัง (เช่น
     กรรมการถูกถอนหลังเริ่มแมตช์ → 409 INSUFFICIENT_REFEREES) สกอร์เข้าไปแล้วแต่ตัวเลข
     ที่พิมพ์ไว้หายหมด ต้อง catch ไว้เอง ไม่งั้น mutateAsync reject ลอยและหน้าจอเงียบสนิท */
  const onSubmit = async () => {
    if (submitting.current || busy || !m.viewer.can.submitResult || blocked || statProblems.length) return
    submitting.current = true
    setSaving(true)
    setFeedback(null)
    let scoreSaved = false
    try {
      await onSubmitUnsafe(() => { scoreSaved = true })
      setFeedback({ kind: 'success', text: 'Result saved.' })
      setReview(false)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Try again.'
      setFeedback({ kind: scoreSaved ? 'partial' : 'error', text: scoreSaved
        ? `Score saved. Player statistics were not saved. ${detail} Your numbers are retained; review and submit again.`
        : `Result not saved. ${detail} Your draft is retained.` })
    } finally { submitting.current = false; setSaving(false) }
  }

  const onSubmitUnsafe = async (onScoreSaved: () => void) => {
    await submit.mutateAsync({
      winnerTeamId: winnerTeamId(),
      scoreData: {
        a: sa,
        b: sb,
      },
    })
    onScoreSaved()
    /* สถิติเป็นคนละตาราง (player_match_stats) จึงเป็นคนละ request
       ส่งเฉพาะคนที่มีตัวเลขจริง — แถวศูนย์ล้วนไม่ต้องเก็บ */
    if (m.viewer.can.recordStats && statDefs.length) {
      const entries = sides.flatMap(t => t.players.map(p => {
        const values: Record<string, number> = {}
        statDefs.forEach(d => { values[d.statKey] = stat[key(p.id, d.statKey)] ?? 0 })
        return { userId: p.id, teamId: t.id, values }
      })).filter(e => Object.values(e.values).some(Boolean))
      if (entries.length) await saveStats.mutateAsync({ entries })
    }
  }

  /* OD-20: no match can finish level in any format. The on-field tiebreak is
     reflected in the aggregate score; Draw/Decider are not separate inputs. */
  const blocked = level || !Number.isSafeInteger(sa) || !Number.isSafeInteger(sb) || sa < 0 || sb < 0 || sa > 999 || sb > 999

  /* สถิติที่ขัดกับสกอร์ — เช่นฟุตบอลที่มีแอสซิสต์ทั้งที่ไม่มีประตู
     ตรวจสดขณะกรอก คนกรอกจะได้เห็นก่อนกดส่ง ไม่ใช่โดนปฏิเสธทีหลัง */
  const statProblems = m.viewer.can.recordStats && statDefs.length
    ? checkResult({
        sportName: m.tournament.sportName,
        teamA: m.teamA ? { id: m.teamA.id, name: m.teamA.name } : null,
        teamB: m.teamB ? { id: m.teamB.id, name: m.teamB.name } : null,
        scoreA: sa,
        scoreB: sb,
        deciderGiven: false,
        statKeys: statDefs.map(d => d.statKey),
        entries: sides.flatMap(t => t.players.map(p => ({
          userId: p.id,
          teamId: t.id,
          values: Object.fromEntries(statDefs.map(d => [d.statKey, stat[key(p.id, d.statKey)] ?? 0])),
        }))),
      })
    : []

  const problemText = (problem: string) => problem
    .replace('สกอร์ติดลบไม่ได้', 'Scores cannot be negative.')
    .replace('สกอร์ไม่เสมอ จึงไม่ต้องมีตัวตัดสิน — ลบค่าในช่องตัวตัดสินออก', 'Remove the tiebreak when the scores are not level.')
    .replace(/: สกอร์ (\d+) แต่รวมของผู้เล่นได้ (\d+) — ต้องเท่ากัน$/, ': score $1, player total $2. These must match.')
    .replace(/: มีแอสซิสต์ (\d+) ทั้งที่ไม่มีประตูเลย$/, ': $1 assists recorded with no goals.')
    .replace(/: แอสซิสต์ (\d+) มากกว่าประตู (\d+) — หนึ่งประตูมีแอสซิสต์ได้ไม่เกินหนึ่ง$/, ': $1 assists exceed $2 goals. Each goal allows at most one assist.')
  const problemField = (problem: string) => {
    const team = sides.find(side => problem.startsWith(`${side.name}:`))
    const column = problem.includes('แอสซิสต์') ? 'assists' : ['goals', 'points', 'kills', 'score'].find(key => statDefs.some(def => def.statKey === key))
    return team?.players[0] && column
      ? { id: `stat-${team.players[0].id}-${column}`, label: `Check ${team.name} statistics` }
      : { id: 'sc-a', label: 'Check scores' }
  }
  const focusProblem = (id: string) => {
    const field = document.getElementById(id)
    if (field) { field.focus(); return }
    setTeamFilter('')
    setPlayerSearch('')
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }

  // ผลอาจรีเฟรชก่อนคำขอสถิติจบ ต้องคงฟอร์มจนแสดงผลของทั้งสองคำขอครบ
  if (!visible && !saving && feedback?.kind !== 'partial' && feedback?.kind !== 'error') return null

  return (
    <Panel className="match-result-form">
      <h2>Record result</h2>
      <span className="sub">
        {m.mode === 'onsite' ? 'Referee' : 'Winning team leader'} — enter the result
      </span>

      <div className="match-result-body" role="region" aria-label="Result entry fields" tabIndex={0}>
      <div className="grid2 match-score-inputs">
        <Field label={m.teamA?.name ?? 'Home'} htmlFor="sc-a">
          <input id="sc-a" disabled={busy} aria-invalid={blocked} aria-describedby={blocked ? "result-blockers" : undefined} type="number" min={0} max={999} value={sa} onChange={e => setSa(Number(e.target.value))} />
        </Field>
        <Field label={m.teamB?.name ?? 'Away'} htmlFor="sc-b">
          <input id="sc-b" disabled={busy} aria-invalid={blocked} type="number" min={0} max={999} value={sb} onChange={e => setSb(Number(e.target.value))} />
        </Field>
      </div>

      {blocked ? (
        <Banner kind="warn">
          <div id="result-blockers"><b>Every match needs a winner.</b> Finish the tiebreak, then enter the final score.
            {' '}<a href="#sc-a" onClick={e => { e.preventDefault(); document.getElementById('sc-a')?.focus() }}>Enter a winning score using whole numbers from 0 to 999.</a>
          </div>
        </Banner>
      ) : null}

      {statProblems.length ? (
        <Banner kind="crit">
          <b>Check the player statistics.</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {statProblems.map(p => {
              const field = problemField(p)
              return <li key={p}>{problemText(p)} <a href={`#${field.id}`} onClick={e => { e.preventDefault(); focusProblem(field.id) }}>{field.label}</a></li>
            })}
          </ul>
        </Banner>
      ) : null}

      {m.viewer.can.recordStats && statDefs.length ? (
        <>
          <span className="tag">
            <em>//</em> {m.tournament.sportName} — per player. These feed the top scorers and every profile.
          </span>
          <div className="match-stat-filters">
            <label className="field">Statistics team<select value={teamFilter} disabled={busy} onChange={e => setTeamFilter(e.target.value)}>
              <option value="">Both teams</option>
              {sides.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select></label>
            <label className="field">Find player<input type="search" value={playerSearch} disabled={busy}
              placeholder="Player name" onChange={e => setPlayerSearch(e.target.value)} /></label>
            <span className="sub" role="status">{visiblePlayers.length} of {players.length} players</span>
            {teamFilter || playerSearch ? <button className="btn ghost" type="button" disabled={busy}
              onClick={() => { setTeamFilter(''); setPlayerSearch('') }}>Clear player filters</button> : null}
          </div>
          <TableWrap label="Player statistics entry">
            <table>
              <thead>
                <tr>
                  <th>Player</th><th>Squad</th>
                  {statDefs.map(d => <th key={d.statKey}>{d.statLabelTh}</th>)}
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map(({ team: t, player: p }) => (
                  <tr key={`${t.id}-${p.id}`}>
                    <td>{p.fullName}</td>
                    <td><TeamChipView team={toTeamView(t)} /></td>
                    {statDefs.map(d => <td key={d.statKey}>{num(p.id, d.statKey, `${d.statLabelTh || d.statKey} for ${p.fullName}`)}</td>)}
                  </tr>
                ))}
                {!visiblePlayers.length ? <tr><td colSpan={statDefs.length + 2}>No players match these filters. Clear the player filters to see both teams.</td></tr> : null}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}

      {submit.isError ? (
        <Banner kind="crit">
          Could not save the result.{' '}
          {/* ฟอร์มเปิดเฉพาะแมตช์ที่ finished แล้ว — เหลือไว้เผื่อสถานะเปลี่ยนระหว่างที่ฟอร์มค้างอยู่ */}
          {(submit.error as { code?: string } | null)?.code === 'MATCH_NOT_FINISHED'
            ? 'The match has to be finished before its result can be sent. Reload the page — Finish the match is in Match control.'
            : submit.error instanceof Error ? submit.error.message : 'Try again.'}
        </Banner>
      ) : null}

      {/* สกอร์ผ่านแล้วแต่สถิติไม่ผ่าน — ต้องบอก ไม่งั้นกรรมการปิดหน้าไปโดยคิดว่าบันทึกครบ */}
      {saveStats.isError ? (
        <Banner kind="crit">
          <b>The score is in, but the player stats were not saved.</b>{' '}
          {saveStats.error instanceof Error ? saveStats.error.message : ''} The numbers above are
          still here — press Submit again to send them.
        </Banner>
      ) : null}
      </div>
      <div className="match-result-footer">
      {feedback ? <p role={feedback.kind === 'success' ? 'status' : 'alert'} className={`match-save-feedback ${feedback.kind}`}>{feedback.text}</p> : null}
      <button className="btn primary" type="button" disabled={busy || !m.viewer.can.submitResult || blocked || statProblems.length > 0}
        onClick={() => { setFeedback(null); setReview(true) }}>Review result</button>
      </div>
      <Modal open={review && active} title="Review result" className="match-result-dialog" onClose={() => { if (!busy && !submitting.current) setReview(false) }}>
        <div className="match-dialog-body" role="region" aria-label="Result review" tabIndex={0}>
          <div className="match-review-scores">
            <div><b>{m.teamA?.name ?? 'Home'}</b><strong>{sa}</strong></div>
            <div><b>{m.teamB?.name ?? 'Away'}</b><strong>{sb}</strong></div>
          </div>
          <p className="sub">Check both teams and the final score. The existing confirmation process follows submission.</p>
          {m.viewer.can.recordStats && statDefs.length ? <p className="sub">Player statistics are saved separately after the score.</p> : null}
          {feedback && feedback.kind !== 'success' ? <p role="alert" className={`match-save-feedback ${feedback.kind}`}>{feedback.text}</p> : null}
        </div>
        <div className="match-dialog-footer">
          <button className="btn" type="button" disabled={busy} onClick={() => setReview(false)}>Back to edit</button>
          <button className="btn primary" type="button" disabled={busy || !m.viewer.can.submitResult || blocked || statProblems.length > 0} onClick={() => void onSubmit()}>
            {busy ? 'Saving…' : 'Submit result'}
          </button>
        </div>
      </Modal>
    </Panel>
  )
}
