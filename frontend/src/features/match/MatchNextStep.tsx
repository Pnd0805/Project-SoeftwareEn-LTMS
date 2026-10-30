import { useIsMutating } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { ContractErrorDetails } from '../../components/kit/ContractErrorDetails'
import { Banner, Panel } from '../../components/kit/primitives'
import { openCheckinKey } from '../../hooks/matchKeys'
import { useOpenMatchCheckin } from '../../hooks/useMatch'
import { lifecycleError } from './lifecycleError'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'
import { matchTime } from './matchTime'

export function MatchNextStep({ m, result }: { m: MatchDto; result?: MatchResultDto }) {
  const navigate = useNavigate()
  const location = useLocation()
  const can = m.viewer.can
  const openCheckin = useOpenMatchCheckin(m.id, m.tournamentId)
  const opening = useIsMutating({ mutationKey: openCheckinKey(m.id) }) > 0
  /* เปิดเช็คอินจากปุ่มนี้ได้เลย — เดิมปุ่มนี้แค่พาไปหา Open check-in อีกปุ่มใน Overview
     จึงต้องกดสองครั้ง และ error ก็ไปขึ้นไกลจากปุ่มที่กด (เอกสารแก้ UI ข้อ 10) */
  let opensCheckin = false
  let title = 'Follow the match'
  let note = 'Available actions appear in Overview. Your permissions are set by the tournament.'
  let action = { label: 'Open overview', path: `/m/${m.id}/overview`, focus: '.match-section[aria-label="Overview"]' }
  if (!m.teamA || !m.teamB) {
    title = 'Waiting for teams'; note = 'Earlier rounds must finish before both teams are known.'
  } else if (result?.status === 'disputed' || m.status === 'disputed') {
    title = can.resolveDispute ? 'Review the dispute' : 'Waiting for a decision'
    note = 'The organizer reviews the recorded result and the dispute.'
    if (can.resolveDispute) action.label = 'Review dispute'
  } else if (['verified', 'walkover'].includes(result?.status ?? m.resultStatus ?? '')) {
    title = 'Result settled'; note = 'View History for the recorded outcome and decisions.'
    action = { label: 'View history', path: `/m/${m.id}/progress`, focus: '.match-section[aria-label="History"]' }
  } else if (result?.status === 'submitted' || m.resultStatus === 'submitted') {
    const confirms = can.verifyResult && (m.mode !== 'onsite' || result?.winnerTeamId === m.viewer.myTeamId)
    title = confirms ? 'Confirm the result' : 'Waiting for confirmation'
    note = m.mode === 'onsite' ? 'The winning team leader confirms the referee’s result.' : 'The referee confirms the submitted result.'
    if (confirms) action.label = 'Confirm result'
  } else if (m.status === 'in_progress') {
    title = can.finishMatch ? 'Finish play, then record' : 'Match in progress'
    note = 'Result entry opens after play is finished.'
    if (can.finishMatch) action.label = 'Finish play'
  } else if (can.submitResult) {
    title = 'Record the result'; note = 'Enter the final score and player statistics, then review before sending.'
    action.label = 'Record result'
  } else if (can.manageCheckin && m.status === 'checkin_open') {
    title = 'Check readiness'; note = 'Review check-ins and the assigned referees before starting.'
    action = { label: 'Manage check-in', path: `/checkin/${m.id}`, focus: 'main h1' }
  } else if (can.openCheckin) {
    if (m.scheduledTime && m.scheduledEndTime && m.venue) {
      title = 'Open check-in'; note = 'Both squads can then confirm they are here. The fixture can no longer be changed.'
      action.label = 'Open check-in'
      opensCheckin = true
    } else {
      title = 'Set the fixture'; note = 'The fixture needs a start time, end time and venue before check-in opens.'
      action = { label: 'Edit fixture', path: `/m/${m.id}/fixture`, focus: 'main h1' }
    }
  } else if (can.manageCheckin) {
    title = 'Manage check-in'; note = 'Open the console to review player readiness.'
    action = { label: 'Manage check-in', path: `/checkin/${m.id}`, focus: 'main h1' }
  } else if (can.editFixture) {
    title = 'Set the fixture'; note = 'Set the time and venue before check-in opens.'
    action = { label: 'Edit fixture', path: `/m/${m.id}/fixture`, focus: 'main h1' }
  }
  return <Panel className="match-summary-frame match-next-step">
    <h2>Next action</h2><strong className="match-next-title">{title}</strong>
    <p className="sub">{note}</p>
    <button className="btn primary" type="button" disabled={opensCheckin && opening} onClick={() => {
      if (opensCheckin) { openCheckin.mutate(); return }
      navigate(action.path, { state: location.state })
      requestAnimationFrame(() => {
        const focus = () => {
          const target = document.querySelector<HTMLElement>(action.focus)
          if (!target || target.closest('[hidden]')) return false
          if (!target.hasAttribute('tabindex')) target.tabIndex = -1
          target.focus()
          return true
        }
        if (focus()) return
        const observer = new MutationObserver(() => { if (focus()) observer.disconnect() })
        observer.observe(document.body, { childList: true, subtree: true })
        setTimeout(() => observer.disconnect(), 5000)
      })
    }}>{opensCheckin && opening ? 'Opening…' : action.label}</button>
    {opensCheckin && openCheckin.isError ? (
      <Banner kind="crit">
        <b>That did not go through.</b> {lifecycleError(openCheckin.error)}
        <ContractErrorDetails error={openCheckin.error} />
      </Banner>
    ) : null}
    {m.checkinOpenAt && ['scheduled', 'checkin_open'].includes(m.status) ? <div className="match-time-note">Check-in opens <b>{matchTime(m.checkinOpenAt)}</b></div> : null}
  </Panel>
}
