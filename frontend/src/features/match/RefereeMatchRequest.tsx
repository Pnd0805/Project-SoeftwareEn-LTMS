import { useNow } from '../../hooks/useNow'
import { useState } from 'react'
import { Badge, Banner, Field, Panel } from '../../components/kit/primitives'
import { useTournamentMatches, useTournamentMatchReferees } from '../../hooks/useMatch'
import { useRequestRefereeTransfer, useRequestRefereeSwap } from '../../hooks/useAdmin'
import type { MatchDto, MatchListItemDto } from '../../types/match.dto'
import type { TournamentRefereeDto } from '../../types/admin.dto'

function changeable(match: Pick<MatchListItemDto, 'status' | 'scheduledTime' | 'scheduledEndTime'>, now: number) {
  return match.status === 'scheduled' && !!match.scheduledEndTime && !!match.scheduledTime
    && Date.parse(match.scheduledTime) > now
}

export function RefereeMatchRequest({ m }: { m: MatchDto }) {
  const now = useNow()
  const allowed = m.viewer.roles.includes('referee') && changeable(m, now)
  if (!allowed) return null
  return <RefereeRequestMatches m={m} />
}

function RefereeRequestMatches({ m }: { m: MatchDto }) {
  const matches = useTournamentMatches(m.tournamentId)
  if (matches.isPending) return <Panel quiet>Loading matches for a transfer or swap...</Panel>
  if (matches.isError) return <Banner kind="crit">Could not load matches. {matches.error instanceof Error ? matches.error.message : 'Please retry.'}</Banner>
  return <RefereeRequestForm key={m.id} tournamentId={m.tournamentId}
    matches={matches.data?.items ?? []} myMatch={m} />
}

/** Both forms select real invitation IDs from server reads. The server rechecks eligibility and conflicts. */
export function RefereeRequestForm({ tournamentId, matches, myMatch, pool }: {
  tournamentId: number
  matches: MatchListItemDto[]
  myMatch?: MatchDto
  pool?: TournamentRefereeDto[]
}) {
  const now = useNow()
  const assignmentQueries = useTournamentMatchReferees(matches.map(m => m.id))
  const transfer = useRequestRefereeTransfer()
  const swap = useRequestRefereeSwap(tournamentId)
  const [kind, setKind] = useState<'transfer' | 'swap'>(myMatch ? 'transfer' : 'swap')
  const [matchAId, setMatchAId] = useState(myMatch?.id ?? 0)
  const [matchBId, setMatchBId] = useState(0)
  const [refereeAId, setRefereeAId] = useState(0)
  const [refereeBId, setRefereeBId] = useState(0)
  const [notice, setNotice] = useState('')
  const refsOf = (id: number) => assignmentQueries[matches.findIndex(m => m.id === id)]?.data?.items ?? []
  const known = [...new Map(assignmentQueries.flatMap(q => q.data?.items ?? [])
    .map(r => [r.tournamentRefereeId, r])).values()]
  const targets = myMatch ? known.filter(r => r.referee.id !== myMatch.viewer.myUserId
    && !refsOf(myMatch.id).some(a => a.referee.id === r.referee.id)) : []
  const sourceRefs = refsOf(matchAId).filter(r => pool?.some(p => p.id === r.tournamentRefereeId && p.isActive))
  const targetRefs = refsOf(matchBId).filter(r => r.tournamentRefereeId !== refereeAId
    && pool?.some(p => p.id === r.tournamentRefereeId && p.isActive))
  const eligible = matches.filter(m => changeable(m, now))
  const theirMatches = eligible.filter(m => m.id !== matchAId
    && refsOf(m.id).some(r => r.tournamentRefereeId === refereeBId))
  const loading = assignmentQueries.some(q => q.isPending)
  const failedRead = assignmentQueries.some(q => q.isError)
  const busy = transfer.isPending || swap.isPending
  const error = transfer.error ?? swap.error
  const sourceValid = myMatch ? refsOf(matchAId).some(r => r.referee.id === myMatch.viewer.myUserId)
    : sourceRefs.some(r => r.tournamentRefereeId === refereeAId)
  const targetValid = myMatch ? targets.some(r => r.tournamentRefereeId === refereeBId)
    : targetRefs.some(r => r.tournamentRefereeId === refereeBId)
  const valid = sourceValid && targetValid && eligible.some(m => m.id === matchAId)
    && (kind === 'transfer' || eligible.some(m => m.id === matchBId && m.id !== matchAId)
      && refsOf(matchBId).some(r => r.tournamentRefereeId === refereeBId))
  const reset = () => { transfer.reset(); swap.reset(); setNotice('') }
  const submit = () => {
    if (!valid || loading || failedRead || busy) return
    const callbacks = { onSuccess: (request: { id: number; status: string }) => {
      setNotice(`Request #${request.id}: ${request.status}. Assignments change only after all required referees accept.`)
    } }
    if (myMatch) transfer.mutate({ myMatchId: matchAId, toTournamentRefereeId: refereeBId,
      ...(kind === 'swap' ? { theirMatchId: matchBId } : {}) }, callbacks)
    else swap.mutate({ refereeAId, matchAId, refereeBId, matchBId }, callbacks)
  }
  return <Panel quiet>
    <h3>{myMatch ? 'Request a transfer or swap' : 'Propose a referee swap'}</h3>
    <div className="sub">Only future scheduled matches with start and end times can change. The server checks assignments and schedule conflicts again when everyone accepts.</div>
    {loading ? <span className="sub">Loading assigned referees...</span> : null}
    {failedRead ? <Banner kind="crit">Could not read referee assignments. Reload before sending a request.</Banner> : null}
    <fieldset disabled={busy || loading || failedRead} style={{ border: 0, padding: 0 }}>
      {myMatch ? <>
        <Field label="Request type" htmlFor="ref-request-kind"><select id="ref-request-kind" value={kind}
          onChange={e => { reset(); setKind(e.target.value as 'transfer' | 'swap'); setMatchBId(0) }}>
          <option value="transfer">Transfer my match</option><option value="swap">Swap matches</option>
        </select></Field>
        <Field label="Receiving referee" htmlFor="ref-request-target"><select id="ref-request-target" value={refereeBId}
          onChange={e => { reset(); setRefereeBId(Number(e.target.value)); setMatchBId(0) }}>
          <option value={0}>Choose a referee...</option>
          {targets.map(r => <option key={r.tournamentRefereeId} value={r.tournamentRefereeId}>{r.referee.fullName}</option>)}
        </select></Field>
        <span className="sub">This list shows other referees already assigned in this tournament. For a referee without a match, ask the organizer to arrange an assignment.</span>
      </> : <>
        <Field label="First match" htmlFor="ref-request-match-a"><select id="ref-request-match-a" value={matchAId}
          onChange={e => { reset(); setMatchAId(Number(e.target.value)); setRefereeAId(0); setMatchBId(0); setRefereeBId(0) }}>
          <option value={0}>Choose a match...</option>
          {eligible.map(m => <option key={m.id} value={m.id}>Match #{m.id}</option>)}
        </select></Field>
        <Field label="First referee" htmlFor="ref-request-ref-a"><select id="ref-request-ref-a" value={refereeAId}
          onChange={e => { reset(); setRefereeAId(Number(e.target.value)); setRefereeBId(0) }}>
          <option value={0}>Choose an assigned referee...</option>
          {sourceRefs.map(r => <option key={r.tournamentRefereeId} value={r.tournamentRefereeId}>{r.referee.fullName}</option>)}
        </select></Field>
      </>}
      {kind === 'swap' ? <Field label="Second match" htmlFor="ref-request-match-b"><select id="ref-request-match-b" value={matchBId}
        onChange={e => { reset(); setMatchBId(Number(e.target.value)); if (!myMatch) setRefereeBId(0) }}>
        <option value={0}>Choose a match...</option>
        {(myMatch ? theirMatches : eligible.filter(m => m.id !== matchAId)).map(m => <option key={m.id} value={m.id}>Match #{m.id}</option>)}
      </select></Field> : null}
      {!myMatch ? <Field label="Second referee" htmlFor="ref-request-ref-b"><select id="ref-request-ref-b" value={refereeBId}
        onChange={e => { reset(); setRefereeBId(Number(e.target.value)) }}>
        <option value={0}>Choose an assigned referee...</option>
        {targetRefs.map(r => <option key={r.tournamentRefereeId} value={r.tournamentRefereeId}>{r.referee.fullName}</option>)}
      </select></Field> : null}
      <button className="btn primary" type="button" disabled={!valid || busy || loading || failedRead || !!notice} onClick={submit}>
        {busy ? 'Sending...' : 'Send request'}
      </button>
    </fieldset>
    {error ? <Banner kind="crit">{error.message}</Banner> : null}
    {notice ? <Banner kind="ok">{notice} <Badge kind="warn">Check Inbox for the decision</Badge></Banner> : null}
    {!loading && !failedRead && !eligible.length ? <span className="sub">No future scheduled matches are available.</span> : null}
  </Panel>
}