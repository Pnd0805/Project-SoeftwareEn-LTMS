/**
 * src/features/tournament/manage/EntryFilterPanel.tsx
 *
 * Two filters, side by side and deliberately unalike. The Soft filter is Entry
 * notes — free text the system never checks, editable whenever. The Hard filter
 * is the enforced conditions: set once at creation, with no override, so an
 * organizer who wants them changed asks an admin with a reason.
 *
 * ส่ง id ที่หน้าถืออยู่ตรงๆ — เดิม Number('t-fb') = NaN บันทึกแล้วไม่มีอะไรเปลี่ยน
 * และหน้าต่างปิดทันทีโดยไม่รอผล จึงไม่มีทางรู้ว่าล้มเหลว
 */
import { useState } from 'react'
import { Badge, Banner, Field, Panel } from '../../../components/kit/primitives'
import { Icon } from '../../../components/kit/Icon'
import { Modal } from '../../../components/kit/Modal'
import { useLtms } from '../../../shared/store'
import { USE_MOCK } from '../../../api/client'
import { EntryRulesPanel } from './EntryRulesPanel'
import { useRequestFilterChange, useSaveEntryNotes } from '../../../hooks/useTournament'
import { FACULTIES, MAJORS, ruleSummary } from '../../../shared/rules'
import type { Rules, Tournament } from '../../../shared/types'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'

function RulesForm({ value, onChange }: { value: Rules; onChange: (r: Rules) => void }) {
  const set = (patch: Partial<Rules>) => onChange({ ...value, ...patch })
  return (
    <div className="grid2">
      <Field label="Gender" htmlFor="rf-gender">
        <select id="rf-gender" value={value.gender} onChange={e => set({ gender: e.target.value as Rules['gender'] })}>
          <option value="any">Any</option><option value="Male">Male</option><option value="Female">Female</option>
        </select>
      </Field>
      <Field label="Year of study" htmlFor="rf-year">
        <select id="rf-year" value={String(value.year)} onChange={e => set({ year: e.target.value === 'any' ? 'any' : Number(e.target.value) })}>
          <option value="any">Any</option>{[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </Field>
      <Field label="Minimum age" htmlFor="rf-lo">
        <input id="rf-lo" value={String(value.ageMin)} onChange={e => set({ ageMin: e.target.value === 'any' || !e.target.value ? 'any' : Number(e.target.value) })} />
      </Field>
      <Field label="Maximum age" htmlFor="rf-hi">
        <input id="rf-hi" value={String(value.ageMax)} onChange={e => set({ ageMax: e.target.value === 'any' || !e.target.value ? 'any' : Number(e.target.value) })} />
      </Field>
      <Field label="Faculty" htmlFor="rf-fac">
        <select id="rf-fac" value={value.faculty} onChange={e => set({ faculty: e.target.value })}>
          <option value="any">Any</option>{FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>
      <Field label="Major" htmlFor="rf-maj">
        <select id="rf-maj" value={value.major} onChange={e => set({ major: e.target.value })}>
          <option value="any">Any</option>{MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
    </div>
  )
}

export function EntryFilterPanel({ t }: { t: Tournament }) {
  /* โหมดจริงเป็นคนละเรื่องกันเกือบทั้งแผง: กฎมาจาก eligibility_rules ซึ่งเก็บได้หลายคณะ
     และหลายชั้นปี (`Rules` ของ prototype มีช่องละค่าเดียว จึงยุบของจริงทิ้ง) การแก้ก็
     ต้องผ่านคำขอที่แอดมินอนุมัติ ไม่ใช่เขียนทับ — แยกไฟล์ดีกว่าใส่ if ทั้งแผง */
  if (!USE_MOCK) return <EntryRulesPanel t={t} />
  return <StoreEntryFilterPanel t={t} />
}

function StoreEntryFilterPanel({ t }: { t: Tournament }) {
  useLtms()
  const saveNotes = useSaveEntryNotes(t.id)
  const requestChange = useRequestFilterChange(t.id)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(t.entryNotes ?? '')
  const [changeOpen, setChangeOpen] = useState(false)
  const [draft, setDraft] = useState<Rules>(t.rules)
  const [reason, setReason] = useState('')

  return (
    <>
      <div className="vstack" style={{ gap: 8 }}>
        <Panel quiet>
          <div className="who">
            <span className="avatar" style={{ background: 'var(--teal)' }}><Icon name="bell" size={13} /></span>
            <span className="meta"><b>Soft filter</b><span className="tag">Entry notes — the system shows them, it never checks them</span></span>
            {t.entryNotes ? <Badge kind="ok">Published</Badge> : null}
            <button className="btn ghost" type="button" aria-label="Edit soft filter"
              onClick={() => { saveNotes.reset(); setNotes(t.entryNotes ?? ''); setNotesOpen(true) }}>
              <Icon name="chev" size={14} />
            </button>
          </div>
          {t.entryNotes ? <div style={{ fontSize: 15, lineHeight: 1.55 }}>{t.entryNotes}</div> : null}
        </Panel>

        <Panel quiet>
          <div className="who">
            <span className="avatar" style={{ background: 'var(--red)' }}><Icon name="shield" size={13} /></span>
            <span className="meta"><b>Hard filter</b><span className="tag">Enforced on every player of the squad list</span></span>
            {t.filterChangeRequest ? <Badge kind="warn">Change requested</Badge> : null}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>{ruleSummary(t.rules) || 'Open to everybody'}</div>
          {t.filterChangeRequest ? (
            <div className="banner warn">
              <Icon name="clock" size={16} />
              <span className="grow">
                An admin has your request for <strong>{ruleSummary(t.filterChangeRequest.rules) || 'no conditions'}</strong>: {t.filterChangeRequest.reason}
              </span>
            </div>
          ) : (
            <button className="btn ghost" type="button" style={{ alignSelf: 'flex-start' }}
              onClick={() => { requestChange.reset(); setDraft(t.rules); setReason(''); setChangeOpen(true) }}>
              <Icon name="plus" size={14} /> Request a change
            </button>
          )}
        </Panel>
      </div>

      <Modal open={notesOpen} onClose={() => setNotesOpen(false)} label="Soft filter" title={t.name}>
        <Field label="Soft filter" htmlFor="en-text">
          <textarea id="en-text" rows={5} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
        {saveNotes.isError ? <Banner kind="crit"><b>Couldn't save the notes.</b> {errorMessage(saveNotes.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setNotesOpen(false)}>Cancel</button>
          <button className="btn primary" type="button" disabled={saveNotes.isPending}
            onClick={() => saveNotes.mutate(notes, { onSuccess: () => setNotesOpen(false) })}>
            {saveNotes.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal open={changeOpen} onClose={() => setChangeOpen(false)} label="Request a hard-filter change" title={t.name}>
        <div className="sub">
          The conditions were set once, at creation, and are enforced with no override. An admin decides.
        </div>
        <RulesForm value={draft} onChange={setDraft} />
        <Field label="Why" htmlFor="fc-why">
          <textarea id="fc-why" rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Two faculties merged their intakes, so the year rule now excludes half the entrants." />
        </Field>
        {requestChange.isError ? <Banner kind="crit"><b>Couldn't send the request.</b> {errorMessage(requestChange.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setChangeOpen(false)}>Cancel</button>
          <button className="btn primary" type="button" disabled={!reason.trim() || requestChange.isPending}
            onClick={() => requestChange.mutate({ rules: draft, reason }, {
              onSuccess: () => { setChangeOpen(false); setReason('') },
            })}>
            {requestChange.isPending ? 'Sending…' : 'Send to an admin'}
          </button>
        </div>
      </Modal>
    </>
  )
}
