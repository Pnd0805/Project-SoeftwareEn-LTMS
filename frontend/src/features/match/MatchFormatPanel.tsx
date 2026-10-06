import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setTournamentFormat } from '../../api/tournament'
import { USE_MOCK } from '../../api/client'
import { useSetMatchFormat, useTournamentMatches } from '../../hooks/useMatch'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import type { MatchDto } from '../../types/match.dto'
import { useSportTypes } from '../../hooks/useReference'

export function MatchFormatPanel({ match }: { match: MatchDto }) {
  const matches = useTournamentMatches(match.tournamentId)
  const sports = useSportTypes()
  const supportsBestOf = sports.data?.items.find(s => s.id === match.tournament.sportTypeId)?.supportsBestOf
  const single = useSetMatchFormat(match.id, match.tournamentId)
  const qc = useQueryClient()
  const all = useMutation({ mutationFn: (bestOf: number | null) => setTournamentFormat(match.tournamentId, bestOf), onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['match'] }); qc.invalidateQueries({ queryKey: ['matches'] });
    qc.invalidateQueries({ queryKey: ['tournament'] }); qc.invalidateQueries({ queryKey: ['tournaments'] });
    qc.invalidateQueries({ queryKey: ['livePrediction'] });
  } })
  const [choice, setChoice] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [notice, setNotice] = useState('')
  const value = choice ?? (match.bestOf == null ? '' : String(match.bestOf))
  const bestOf = supportsBestOf === false || value === '' ? null : Number(value)
  const started = (m: Pick<MatchDto, 'status' | 'startedAt'>) => !!m.startedAt || ['in_progress', 'finished', 'completed', 'disputed', 'result_rejected'].includes(m.status)
  const error = single.error ?? all.error
  const locked = started(match) || matches.data?.items.some(started) || (error as { code?: string } | null)?.code === 'MATCH_FORMAT_LOCKED'
  const busy = single.isPending || all.isPending
  const disabled = USE_MOCK || matches.isPending || matches.isError || supportsBestOf === undefined || !!locked || busy
  const apply = async (whole: boolean) => {
    if (disabled) return
    setNotice('')
    try {
      if (whole) await all.mutateAsync(bestOf)
      else await single.mutateAsync({ bestOf })
      setNotice(whole ? 'ตั้งรูปแบบทั้งทัวร์เรียบร้อยแล้ว ค่ารายแมตช์เดิมถูกแทนที่' : 'บันทึกรูปแบบแมตช์เรียบร้อยแล้ว')
      setConfirmAll(false); setChoice(null)
    } catch { /* Display the server message, including a concurrent tournament lock. */ }
  }
  return <Panel quiet><h3>Match format</h3>
    {sports.isError ? <Banner kind="crit">Could not check this sport's BO capability. <button className="btn" onClick={() => void sports.refetch()}>Retry sports</button></Banner> : supportsBestOf === undefined ? <p>Checking sport format…</p> : null}
    {supportsBestOf === false ? <p className="sub">This sport uses a single game score. {match.bestOf != null ? 'Clear the previous BO setting to use the correct format.' : 'No BO setting is needed.'}</p> : null}
    <p className="sub">ตั้งทั้งทัวร์ก่อน แล้วจึงตั้งแมตช์เฉพาะ เช่นรอบชิง การตั้งทั้งทัวร์จะทับค่ารายแมตช์ เมื่อแมตช์แรกเริ่มแข่ง รูปแบบทั้งทัวร์จะถูกล็อก</p>
    {locked ? <Banner kind="neutral">ทัวร์เริ่มแข่งแล้ว ไม่สามารถเปลี่ยนรูปแบบ BO ได้</Banner> : null}
    {matches.isPending ? <p>Checking tournament matches…</p> : null}
    {matches.isError ? <Banner kind="crit">ตรวจสถานะทั้งทัวร์ไม่สำเร็จ <button className="btn" onClick={() => void matches.refetch()}>Retry</button></Banner> : null}
    {supportsBestOf !== false ? <Field label="BO format" htmlFor="fixture-bo"><select id="fixture-bo" value={value} disabled={disabled} onChange={e => { setChoice(e.target.value); single.reset(); all.reset(); setNotice('') }}>
      <option value="">No BO limit</option>{[1, 3, 5, 7].map(n => <option key={n} value={n}>BO{n}</option>)}
    </select></Field> : null}
    {supportsBestOf !== false || match.bestOf != null ? <div className="hstack"><button className="btn" disabled={disabled} onClick={() => setConfirmAll(true)}>Set for whole tournament</button><button className="btn primary" disabled={disabled || (supportsBestOf !== false && choice === null)} onClick={() => void apply(false)}>{supportsBestOf === false ? 'Clear this match BO setting' : 'Set for this match'}</button></div> : null}
    {error ? <Banner kind="crit">{error instanceof Error ? error.message : 'บันทึกรูปแบบไม่สำเร็จ'}</Banner> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <Modal open={confirmAll} onClose={() => !busy && setConfirmAll(false)} title="Replace every match format?">
      <p>{bestOf === null ? 'No BO limit' : `BO${bestOf}`} จะใช้กับทั้งทัวร์ รวมแมตช์ที่เคยตั้งรูปแบบแยกไว้ด้วย</p>
      {error ? <Banner kind="crit">{error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'}</Banner> : null}
      <button className="btn" disabled={busy} onClick={() => setConfirmAll(false)}>Cancel</button><button className="btn primary" disabled={disabled} onClick={() => void apply(true)}>{busy ? 'Saving…' : 'Confirm tournament format'}</button>
    </Modal>
  </Panel>
}
