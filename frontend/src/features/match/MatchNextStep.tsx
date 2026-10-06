import { useLocation, useNavigate } from 'react-router-dom'
import { Panel } from '../../components/kit/primitives'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'
import { matchTime } from './matchTime'

export function MatchNextStep({ m, result }: { m: MatchDto; result?: MatchResultDto }) {
  const navigate = useNavigate()
  const location = useLocation()
  const can = m.viewer.can
  let title = 'Follow the match'
  let note = 'Available actions appear in Overview. Your permissions are set by the tournament.'
  if (!m.teamA || !m.teamB) {
    title = 'Waiting for teams'; note = 'Earlier rounds must finish before both teams are known.'
  } else if (result?.status === 'disputed' || m.status === 'disputed') {
    title = can.resolveDispute ? 'Review the dispute' : 'Waiting for a decision'
    note = 'The organizer reviews the recorded result and the dispute.'
  } else if (result?.status === 'verified' || result?.status === 'walkover') {
    title = 'Result settled'; note = 'View History for the recorded outcome and decisions.'
  } else if (result?.status === 'submitted' || m.resultStatus === 'submitted') {
    const confirms = can.verifyResult && (m.mode !== 'onsite' || result?.winnerTeamId === m.viewer.myTeamId)
    title = confirms ? 'Confirm the result' : 'Waiting for confirmation'
    note = m.mode === 'onsite' ? 'The winning team leader confirms the referee’s result.' : 'The referee confirms the submitted result.'
  } else if (m.status === 'in_progress') {
    title = can.finishMatch ? 'Finish play, then record' : 'Match in progress'
    note = 'Result entry opens after play is finished.'
  } else if (can.submitResult) {
    title = 'Record the result'; note = 'Enter the final score and player statistics, then review before sending.'
  } else if (can.manageCheckin && m.status === 'checkin_open') {
    title = 'Check readiness'; note = 'Review check-ins and the assigned referees before starting.'
  } else if (can.openCheckin) {
    title = 'Open check-in'; note = 'The fixture must have a start time, end time and venue.'
  } else if (can.manageCheckin) {
    title = 'Manage check-in'; note = 'Open the console to review player readiness.'
  } else if (can.editFixture) {
    title = 'Set the fixture'; note = 'Set the time and venue before check-in opens.'
  }
  return <Panel className="match-summary-frame match-next-step">
    <h2>Next action</h2><strong className="match-next-title">{title}</strong>
    <p className="sub">{note}</p>
    <button className="btn primary" type="button" onClick={() => {
      navigate(`/m/${m.id}/overview`, { state: location.state })
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.match-section[aria-label="Overview"]')?.focus())
    }}>Open overview</button>
    {m.checkinOpenAt && ['scheduled', 'checkin_open'].includes(m.status) ? <div className="match-time-note">Check-in opens <b>{matchTime(m.checkinOpenAt)}</b></div> : null}
  </Panel>
}
