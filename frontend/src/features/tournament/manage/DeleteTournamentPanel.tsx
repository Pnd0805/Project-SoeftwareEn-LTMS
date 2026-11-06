import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Panel } from '../../../components/kit/primitives'
import { Modal } from '../../../components/kit/Modal'
import { useDeleteTournament, useUnpublishTournament } from '../../../hooks/useTournament'
import type { Tournament } from '../../../shared/types'
import { useManageActive } from './ManageActivity'
import { useRegistrationStarted } from './useRegistrationStarted'
export function DeleteTournamentPanel({ t }: { t: Tournament }) {
  const active = useManageActive()
  const deletion = useDeleteTournament(); const navigate = useNavigate(); const [review, setReview] = useState(false)
  const unpublish = useUnpublishTournament(Number(t.id))
  const started = useRegistrationStarted(t)
  const busy = deletion.isPending || unpublish.isPending
  const failure = deletion.error ?? unpublish.error
  if (started !== false || t.status === 'cancelled' || t.champion) return null
  /* backend ไม่ให้ลบทัวร์ public (TOURNAMENT_MUST_BE_UNPUBLISHED) — เอาลงให้ก่อนในปุ่มเดียว
     ถ้าลบไม่ผ่านหลังเอาลงแล้ว ทัวร์จะค้างเป็น private และยังกดลบซ้ำได้ */
  const remove = async () => {
    try {
      if (t.status === 'public') await unpublish.mutateAsync()
      await deletion.mutateAsync(Number(t.id))
      navigate('/')
    } catch { /* แสดงผ่าน failure ใน dialog */ }
  }
  return <Panel quiet><h3>Delete this tournament</h3><p>Registration hasn't started, so this tournament can still be deleted. The server checks activity before deleting.</p>
    <button className="btn primary" disabled={busy} onClick={() => { deletion.reset(); unpublish.reset(); setReview(true) }}>Review deletion</button>
    <Modal className="organizer-confirm" open={active && review} onClose={() => !busy && setReview(false)} title={`Delete ${t.name}?`}>
      <p>{t.status === 'public' ? 'This takes the tournament off public listings, then deletes it.' : 'This removes the tournament from listings.'} Confirm only if you no longer need it.</p>
      {failure ? <Banner kind="crit">{failure instanceof Error ? failure.message : 'Deletion failed.'}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setReview(false)}>Cancel</button>
      <button className="btn danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting...' : 'Confirm deletion'}</button>
    </Modal>
  </Panel>
}
