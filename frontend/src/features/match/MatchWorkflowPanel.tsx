import { useEffect, useState } from 'react'
import { ScoreInputs } from './ScoreInputs'
import { scoreFormatFromError, validMatchScore } from './scoreFormat'
import { Badge, Banner, Panel } from '../../components/kit/primitives'
import { uploadImage, UPLOAD_IMAGE_ACCEPT, imageUploadErrorMessage } from '../../api/upload'
import { useMe } from '../../hooks/useAuth'
import { useMatchWorkflow } from '../../hooks/useMatchWorkflow'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'
import type { ComplaintDecisionInput, OrganizerResultInput, ResultChallengeInput, ResultComplaint } from '../../types/matchWorkflow.dto'

const errorText = (error: unknown) => error instanceof Error ? error.message : 'The request failed. Please try again.'
const validScore = (m: MatchDto, a: number, b: number, error: unknown) => validMatchScore(scoreFormatFromError(m, error), a, b)
function scoreInput(m: MatchDto, a: number, b: number) {
  return { winnerTeamId: a > b ? m.teamA!.id : m.teamB!.id, scoreData: { [m.teamA!.id]: a, [m.teamB!.id]: b } }
}
function Scores({ m, a, b, setA, setB, disabled = false, error }: { m: MatchDto; a: number; b: number; setA: (value: number) => void; setB: (value: number) => void; disabled?: boolean; error?: unknown }) {
  return <ScoreInputs match={{ ...m, ...scoreFormatFromError(m, error) }} a={a} b={b} setA={setA} setB={setB} disabled={disabled} prefix="workflow-score" labelA={`Score for ${m.teamA?.name}`} labelB={`Score for ${m.teamB?.name}`} />
}
function EvidenceLinks({ urls }: { urls: string[] }) {
  return <div className="hstack">{urls.map((url, i) => /^https?:\/\//i.test(url)
    ? <a key={url} href={url} target="_blank" rel="noopener noreferrer">Evidence {i + 1}</a> : null)}</div>
}
export function ResultChallengeForm({ m, title, pending, error, submit }: {
  m: MatchDto; title: string; pending: boolean; error: unknown; submit: (input: ResultChallengeInput) => Promise<unknown>
}) {
  const [reason, setReason] = useState('')
  const [propose, setPropose] = useState(false)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [keys, setKeys] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [done, setDone] = useState(false)
  const busy = pending || uploading
  return <Panel quiet><h3>{title}</h3>
    {done ? <p role="status">Your request was saved.</p> : null}
    <form className="vstack" onSubmit={async e => {
      e.preventDefault()
      if (busy || !reason.trim() || (propose && !validScore(m, a, b, error))) return
      const score = propose ? scoreInput(m, a, b) : null
      try { await submit({ reason: reason.trim(), ...(score ? { claimedWinnerTeamId: score.winnerTeamId, claimedScoreData: score.scoreData } : {}), ...(keys.length ? { evidenceKeys: keys } : {}) }); setDone(true); setReason(''); setKeys([]) }
      catch { setDone(false) }
    }}>
      <label>Reason (required)<textarea aria-label={`${title} reason`} required maxLength={1000} value={reason} onChange={e => { setReason(e.target.value); setDone(false) }} disabled={busy} /></label>
      <label><input type="checkbox" checked={propose} disabled={busy} onChange={e => setPropose(e.target.checked)} /> Propose a corrected score</label>
      {propose ? <><Scores m={m} a={a} b={b} setA={setA} setB={setB} disabled={busy} error={error} />{!validScore(m, a, b, error) ? <p className="sub">Enter non-negative whole numbers with a winning side.</p> : null}</> : null}
      <label>Evidence (PNG/JPEG, up to 5 files)<input aria-label={`${title} evidence`} type="file" accept={UPLOAD_IMAGE_ACCEPT} multiple disabled={busy || keys.length >= 5}
        onChange={async e => {
          const files = Array.from(e.target.files ?? []); e.target.value = ''
          if (!files.length || busy) return
          setUploadError('')
          if (files.length + keys.length > 5) { setUploadError('Attach no more than 5 files.'); return }
          setUploading(true)
          try { for (const file of files) { const key = await uploadImage(file, 'dispute_evidence', { matchId: m.id }); setKeys(previous => [...previous, key]) } }
          catch (failure) { setUploadError(imageUploadErrorMessage(failure)) }
          finally { setUploading(false) }
        }} /></label>
      {keys.map((key, i) => <span key={key}>Evidence {i + 1} uploaded <button type="button" className="btn ghost" disabled={busy} onClick={() => { setKeys(previous => previous.filter(item => item !== key)); setUploadError('') }}>Remove attachment {i + 1}</button></span>)}
      {uploading ? <p role="status">Uploading evidence...</p> : null}
      {uploadError || error ? <p role="alert">{uploadError || errorText(error)}</p> : null}
      <button className="btn primary" type="submit" disabled={busy || !reason.trim() || !!uploadError || (propose && !validScore(m, a, b, error))}>{pending ? 'Saving...' : title}</button>
    </form>
  </Panel>
}
function OrganizerDecision({ m, pending, error, submit }: { m: MatchDto; pending: boolean; error: unknown; submit: (input: OrganizerResultInput) => Promise<unknown> }) {
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<'result' | 'double_forfeit'>('result')
  const [a, setA] = useState(0); const [b, setB] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const allowed = !!reason.trim() && (outcome === 'double_forfeit' || validScore(m, a, b, error))
  return <Panel quiet><h3>Organizer decision: no result submitted</h3>
    <p className="sub">Available 24 hours after play ends. The backend verifies the deadline and that no active result exists.</p>
    <label>Outcome<select aria-label="Organizer outcome" value={outcome} disabled={pending} onChange={e => { setOutcome(e.target.value as typeof outcome); setConfirm(false) }}>
      <option value="result">Record the played result</option>{m.mode === 'online' ? <option value="double_forfeit">Both teams forfeit</option> : null}</select></label>
    {outcome === 'result' ? <Scores m={m} a={a} b={b} setA={setA} setB={setB} disabled={pending} error={error} /> : <Banner kind="warn">Neither team advances. Confirm this decision only after checking both teams.</Banner>}
    <label>Required explanation<textarea aria-label="Organizer decision reason" maxLength={1000} disabled={pending} value={reason} onChange={e => setReason(e.target.value)} /></label>
    {error ? <p role="alert">{errorText(error)}</p> : null}
    <button className="btn" type="button" disabled={pending || !allowed} onClick={() => setConfirm(true)}>Review organizer decision</button>
    {confirm ? <div><p>Confirm {outcome === 'result' ? `${m.teamA?.name} ${a} - ${b} ${m.teamB?.name}` : 'both teams forfeit'}? Reason: {reason}</p>
      <button className="btn" type="button" disabled={pending} onClick={() => setConfirm(false)}>Cancel decision</button>
      <button className="btn danger" type="button" disabled={pending || !allowed} onClick={async () => {
        try { await submit({ outcome, reason: reason.trim(), ...(outcome === 'result' ? scoreInput(m, a, b) : {}) }); setConfirm(false) } catch { /* mutation error stays visible */ }
      }}>Confirm organizer decision</button></div> : null}
  </Panel>
}
function ComplaintReview({ m, row, organizer, admin, pending, error, statement, decide }: {
  m: MatchDto; row: ResultComplaint; organizer: boolean; admin: boolean; pending: boolean; error: unknown;
  statement: (text: string) => Promise<unknown>; decide: (input: ComplaintDecisionInput) => Promise<unknown>
}) {
  const [text, setText] = useState('')
  const [outcome, setOutcome] = useState<'upheld' | 'no_merit'>('upheld')
  const [amend, setAmend] = useState(false)
  const [a, setA] = useState(row.claimedScoreData?.[String(m.teamA?.id)] ?? 0)
  const [b, setB] = useState(row.claimedScoreData?.[String(m.teamB?.id)] ?? 0)
  return <Panel quiet><h3>Complaint #{row.complaintId} <Badge kind="neutral">{row.status}</Badge></h3>
    <p>{row.filedBy.fullName}: {row.reason}</p><p className="sub">Admin stage begins {new Date(row.escalatesAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}</p>
    {row.claimedScoreData ? <p>Proposed score: {m.teamA?.name} {row.claimedScoreData[String(m.teamA?.id)]} - {row.claimedScoreData[String(m.teamB?.id)]} {m.teamB?.name}</p> : null}
    <EvidenceLinks urls={row.evidence} />
    {row.organizerStatement ? <p>Organizer: {row.organizerStatement.statement}{row.organizerStatement.late ? ' (after the deadline)' : ''}</p> : null}
    {row.decision ? <p>Decision: {row.decision.note} | {row.decision.remedy}</p> : null}
    {row.filerFlagged ? <p className="sub">The backend marked this complaint as having no merit.</p> : null}
    {error ? <p role="alert">{errorText(error)}</p> : null}
    {row.status === 'open' && (organizer || (admin && row.stage === 'admin')) ? <>
      <label>{organizer ? 'Organizer statement' : 'Decision note'}<textarea aria-label={`Complaint ${row.complaintId} note`} maxLength={2000} disabled={pending} value={text} onChange={e => setText(e.target.value)} /></label>
      {organizer ? <button className="btn" type="button" disabled={pending || !text.trim()} onClick={async () => { try { await statement(text.trim()); setText('') } catch { /* mutation owns feedback */ } }}>Save organizer statement</button> : null}
      {admin && row.stage === 'admin' && !organizer ? <>
        <select aria-label={`Complaint ${row.complaintId} outcome`} value={outcome} disabled={pending} onChange={e => { setOutcome(e.target.value as typeof outcome); setAmend(false) }}><option value="upheld">Complaint upheld</option><option value="no_merit">No merit (flags the filer)</option></select>
        {outcome === 'upheld' ? <label><input type="checkbox" checked={amend} disabled={pending || !row.canAmendResult || !m.teamA || !m.teamB} onChange={e => setAmend(e.target.checked)} /> Amend the result</label> : null}
        {!row.canAmendResult ? <p className="sub">Result cannot be amended: {row.amendBlockedBy}</p> : null}
        {amend ? <Scores m={m} a={a} b={b} setA={setA} setB={setB} disabled={pending} error={error} /> : null}
        <button className="btn danger" type="button" disabled={pending || !text.trim() || (amend && !validScore(m, a, b, error))} onClick={async () => {
          try { await decide({ outcome, remedy: amend ? 'amend_result' : 'record_only', note: text.trim(), ...(amend ? scoreInput(m, a, b) : {}) }); setText('') } catch { /* mutation owns feedback */ }
        }}>Save complaint decision</button>
      </> : null}
    </> : null}
  </Panel>
}
export function MatchWorkflowPanel({ m, result }: { m: MatchDto; result?: MatchResultDto }) {
  const me = useMe()
  const organizer = m.viewer.roles.includes('organizer')
  const referee = m.viewer.roles.includes('referee')
  const ownResult = referee && result?.submittedBy?.id === me.data?.id
  const party = referee || m.viewer.isTeamLeader
  const admin = me.data?.adminScope?.scopeType === 'university_wide'
  const read = !!me.data && (organizer || party || !!me.data.adminScope)
  const activeDispute = (result?.status === 'disputed' || m.status === 'disputed') && (organizer || party)
  const flow = useMatchWorkflow(m.id, read, activeDispute)
  const [abandonReason, setAbandonReason] = useState('')
  const [abandonConfirm, setAbandonConfirm] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer) }, [])
  const elapsed = !!m.actualEndTime && now >= Date.parse(m.actualEndTime) + 24 * 3600_000
  if (!me.data) return null
  return <>
    {m.status === 'in_progress' && (organizer || referee) ? <Panel quiet><h3>Abandon and reschedule</h3>
      <p className="sub">Use this when play cannot continue. This returns the match to Scheduled; the organizer then sets a new fixture.</p>
      <label>Reason<textarea aria-label="Abandon reason" maxLength={500} value={abandonReason} disabled={flow.abandon.isPending} onChange={e => setAbandonReason(e.target.value)} /></label>
      {flow.abandon.isError ? <p role="alert">{errorText(flow.abandon.error)}</p> : null}
      <button className="btn" type="button" disabled={!abandonReason.trim() || flow.abandon.isPending} onClick={() => setAbandonConfirm(true)}>Review abandonment</button>
      {abandonConfirm ? <><p>Confirm abandonment? Play will stop and the fixture must be rescheduled.</p>
        <button className="btn" type="button" disabled={flow.abandon.isPending} onClick={() => setAbandonConfirm(false)}>Cancel abandonment</button>
        <button className="btn danger" type="button" disabled={flow.abandon.isPending || !abandonReason.trim()} onClick={async () => { try { await flow.abandon.mutateAsync(abandonReason.trim()); setAbandonConfirm(false) } catch { /* keep mutation error */ } }}>Confirm abandonment</button></> : null}
    </Panel> : null}
    {organizer && m.status === 'finished' && (!result || result.status === 'rejected') && m.teamA && m.teamB ? elapsed
      ? <OrganizerDecision m={m} pending={flow.organizer.isPending} error={flow.organizer.error} submit={flow.organizer.mutateAsync} />
      : <Panel quiet>Organizer result decisions become available 24 hours after the recorded end of play.{m.actualEndTime ? ` Available at ${new Date(Date.parse(m.actualEndTime) + 24 * 3600_000).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}.` : ' The backend has not supplied the actual end time.'}</Panel> : null}
    {ownResult && (result?.status === 'submitted' || result?.status === 'verified') ? <Panel quiet>You recorded this result and cannot dispute it. {m.mode === 'online' && result.status === 'submitted' ? 'Use Edit result with a correction reason.' : 'Ask another authorized referee or a team leader to review or challenge it.'}</Panel> : null}
    {party && !ownResult && m.teamA && m.teamB && (result?.status === 'submitted' || result?.status === 'verified') ? <ResultChallengeForm m={m} title="Dispute this result" pending={flow.challenge.isPending} error={flow.challenge.error} submit={flow.challenge.mutateAsync} /> : null}
    {activeDispute ? <Panel quiet><h3>Dispute details</h3>
      {flow.dispute.isPending ? <p>Loading dispute...</p> : flow.dispute.isError ? <p role="alert">{errorText(flow.dispute.error)}</p> : flow.dispute.data ? <>
        <p>{flow.dispute.data.raisedBy?.fullName ?? 'A match party'}: {flow.dispute.data.reason}</p>
        {flow.dispute.data.claimedScoreData ? <p>Proposed score: {m.teamA?.name} {flow.dispute.data.claimedScoreData[String(m.teamA?.id)]} - {flow.dispute.data.claimedScoreData[String(m.teamB?.id)]} {m.teamB?.name}</p> : null}
        <EvidenceLinks urls={flow.dispute.data.evidence} />
      </> : null}
    </Panel> : null}
    {read ? <Panel quiet><h3>Result complaints</h3><p className="sub">Final results outside the ordinary dispute window can be complained about before tournament closure. The organizer adds a statement; university-wide admins decide after 48 hours.</p>
      {flow.complaints.isPending ? <p>Loading complaints...</p> : flow.complaints.isError ? <><p role="alert">{errorText(flow.complaints.error)}</p><button className="btn" onClick={() => void flow.complaints.refetch()}>Retry complaints</button></>
        : !flow.complaints.data?.complaints.length ? <p>No complaints.</p> : flow.complaints.data.complaints.map(row => <ComplaintReview key={row.complaintId} m={m} row={row} organizer={organizer} admin={admin} pending={flow.statement.isPending || flow.decision.isPending} error={flow.statement.error || flow.decision.error}
          statement={text => flow.statement.mutateAsync({ complaintId: row.complaintId, text })} decide={input => flow.decision.mutateAsync({ complaintId: row.complaintId, input })} />)}
    </Panel> : null}
    {party && m.teamA && m.teamB && (result?.status === 'verified' || result?.status === 'walkover') ? <ResultChallengeForm m={m} title="File result complaint" pending={flow.file.isPending} error={flow.file.error} submit={flow.file.mutateAsync} /> : null}
  </>
}
