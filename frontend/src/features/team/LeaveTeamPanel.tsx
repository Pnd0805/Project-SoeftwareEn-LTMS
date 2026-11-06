import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useLeaveTeam } from '../../hooks/useTeam'

export function LeaveTeamPanel({ teamId, name, leader }: { teamId: number; name: string; leader: boolean }) {
  const leave = useLeaveTeam(teamId)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return <Panel quiet>
    <h3>Team membership</h3>
    {leader ? <p>The captain cannot leave. An admin must approve a captaincy transfer first.</p> : <>
      <p>You can leave this player pool unless an approved tournament entry locks your membership.</p>
      <button className="btn danger" onClick={() => { leave.reset(); setOpen(true) }}>Leave team</button>
      <Modal open={open} onClose={() => !leave.isPending && setOpen(false)} title={`Leave ${name}?`}>
        <p>Your membership will be removed. To return, request to join a public team or ask its captain for another invitation.</p>
        {leave.isError ? <Banner kind="crit">{leave.error.message}</Banner> : null}
        <button className="btn" disabled={leave.isPending} onClick={() => setOpen(false)}>Cancel</button>{' '}
        <button className="btn danger" disabled={leave.isPending} onClick={() => leave.mutate(undefined, { onSuccess: () => navigate('/teams') })}>{leave.isPending ? 'Leaving…' : 'Confirm leave'}</button>
      </Modal>
    </>}
  </Panel>
}
