import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Panel } from '../../../components/kit/primitives'
import { Modal } from '../../../components/kit/Modal'
import { useDeleteTournament } from '../../../hooks/useTournament'
import type { Tournament } from '../../../shared/types'
import { useManageActive } from './ManageActivity'
export function DeleteTournamentPanel({ t }: { t: Tournament }) {
  const active = useManageActive()
  const deletion = useDeleteTournament(); const navigate = useNavigate(); const [review, setReview] = useState(false)
  if (t.status === 'public' || t.champion) return null
  return <Panel quiet><h3>Delete this tournament</h3><p>Only tournaments with no applications or matches can be deleted. The server checks activity before deleting.</p>
    <button className="btn danger" disabled={deletion.isPending} onClick={() => { deletion.reset(); setReview(true) }}>Review deletion</button>
    <Modal className="organizer-confirm" open={active && review} onClose={() => !deletion.isPending && setReview(false)} title={`Delete ${t.name}?`}>
      <p>This removes the tournament from listings. Confirm only if you no longer need it.</p>
      {deletion.error ? <Banner kind="crit">{deletion.error instanceof Error ? deletion.error.message : 'Deletion failed.'}</Banner> : null}
      <button className="btn" disabled={deletion.isPending} onClick={() => setReview(false)}>Cancel</button>
      <button className="btn danger" disabled={deletion.isPending} onClick={() => deletion.mutate(Number(t.id), { onSuccess: () => navigate('/') })}>{deletion.isPending ? 'Deleting...' : 'Confirm deletion'}</button>
    </Modal>
  </Panel>
}
