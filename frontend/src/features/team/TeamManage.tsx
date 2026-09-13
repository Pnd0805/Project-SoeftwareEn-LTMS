/**
 * src/features/team/TeamManage.tsx
 *
 * What only a leader decides about the squad as a whole: its name and short code,
 * its logo, asking for Official status, and disbanding it.
 *
 * ชื่อทีมส่งผ่าน PATCH /teams/:id { name } (FR-TM-04 · 409 TEAM_NAME_TAKEN)
 * รหัสทีมกับโลโก้มีเฉพาะโหมด mock — updateTeamSchema ของ backend รับแค่ name
 * คำร้อง Official ส่ง supportingDocs ตาม team.schema.ts (400 OFFICIAL_DOCS_REQUIRED)
 * ลบทีมได้เฉพาะทีมที่ยังไม่เคยลงแข่ง (FR-TM-05) — backend ยังไม่ตรวจข้อนี้ โหมด mock ตอบ 409
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Field, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { ConfirmCard, Modal } from '../../components/kit/Modal'
import { USE_MOCK } from '../../api/client'
import { useDisbandTeam, useRequestOfficialStatus, useUpdateTeam } from '../../hooks/useTeam'
import { IMAGE_ACCEPT, shrinkImage } from '../../mocks/imageInput'
import { useLtms } from '../../shared/store'
import type { Team } from '../../shared/types'
import type { BackendTeamDto } from '../../types/team.dto'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'

/** รหัสทีมสั้นๆ ที่ใช้บนชิปและตราทีม — ตัวอักษรหรือตัวเลข 2–3 ตัว */
const CODE_PATTERN = /^[A-Za-z0-9]{2,3}$/

/** ตั้งหรือถอดโลโก้ทีม (FR-TM-04) — backend ยังไม่มีคอลัมน์โลโก้ */
function TeamLogoControl({ teamId, logo }: { teamId: number; logo?: string }) {
  const update = useUpdateTeam(teamId)
  const [err, setErr] = useState<string | null>(null)
  const inputId = `logo-${teamId}`

  const pick = async (file: File | undefined) => {
    if (!file) return
    setErr(null)
    try {
      update.mutate({ logoUrl: await shrinkImage(file) })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'ตั้งโลโก้ไม่สำเร็จ')
    }
  }

  return (
    <span className="hstack" style={{ gap: 6 }}>
      <input id={inputId} type="file" accept={IMAGE_ACCEPT} style={{ display: 'none' }}
        onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      <label className="btn ghost" htmlFor={inputId} style={{ cursor: 'pointer' }}>
        <Icon name="plus" size={12} /> {logo ? 'Change logo' : 'Add a logo'}
      </label>
      {logo ? (
        <button className="btn ghost" type="button" disabled={update.isPending}
          onClick={() => update.mutate({ logoUrl: null })}>
          Remove logo
        </button>
      ) : null}
      {err || update.isError ? <span className="sub">{err ?? errorMessage(update.error)}</span> : null}
    </span>
  )
}

export function TeamManage({ data, storeTeam }: { data: BackendTeamDto; storeTeam?: Team }) {
  const s = useLtms()
  const navigate = useNavigate()
  const official = useRequestOfficialStatus(data.id)
  const disband = useDisbandTeam(data.id)
  const details = useUpdateTeam(data.id)
  const [asking, setAsking] = useState(false)
  const [docs, setDocs] = useState('')
  const [disbanding, setDisbanding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  /* backend ไม่มีทางอ่านคำร้องของทีมตัวเอง — โหมด mock ดูจาก store ว่ามีค้างอยู่ไหม */
  const officialPending = !!storeTeam
    && s.permanentRequests.some(r => r.team === storeTeam.id && r.status === 'pending')
  /* FR-TM-05 — ทีมที่เคยได้ที่นั่งในรายการแข่งแล้วลบไม่ได้ โหมด mock รู้ล่วงหน้าจึงปิดปุ่มไว้ */
  const competed = !!storeTeam
    && s.registrations.some(r => r.team === storeTeam.id && r.status === 'approved')
  const docList = docs.split('\n').map(x => x.trim()).filter(Boolean)

  const codeOk = !USE_MOCK || CODE_PATTERN.test(code.trim())
  const changed = name.trim() !== data.name
    || (USE_MOCK && code.trim().toUpperCase() !== (storeTeam?.code ?? ''))

  const openEdit = () => {
    details.reset()
    setName(data.name)
    setCode(storeTeam?.code ?? '')
    setEditing(true)
  }

  const saveEdit = () => {
    setNotice(null)
    details.mutate(USE_MOCK ? { name: name.trim(), code: code.trim() } : { name: name.trim() }, {
      onSuccess: () => {
        setEditing(false)
        setNotice('Saved the squad details.')
      },
    })
  }

  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Run the squad</span>
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      {disband.isError ? <Banner kind="crit"><b>Couldn't disband the squad.</b> {errorMessage(disband.error)}</Banner> : null}

      <div className="hstack" style={{ flexWrap: 'wrap' }}>
        <button className="btn ghost" type="button" onClick={openEdit}>
          {USE_MOCK ? 'Edit name & code' : 'Rename'}
        </button>
        {USE_MOCK && storeTeam ? <TeamLogoControl teamId={data.id} logo={storeTeam.logo} /> : null}
        {data.officialStatus === 'Official' ? <Badge kind="ok">Official — exempt from automatic disabling</Badge>
          : officialPending ? <Badge kind="warn">Official status — with an admin</Badge>
            : (
              <button className="btn ghost" type="button" onClick={() => { official.reset(); setAsking(true) }}>
                Ask to be Official
              </button>
            )}
        <button className="btn danger" type="button" disabled={competed || disband.isPending}
          title={competed ? 'A squad that has held a place in a tournament stays on record' : undefined}
          onClick={() => { disband.reset(); setDisbanding(true) }}>
          {disband.isPending ? 'Disbanding…' : 'Disband'}
        </button>
      </div>
      {competed ? (
        <span className="sub">Disbanding is off — this squad has held a place in a tournament, so it stays on record.</span>
      ) : null}

      <Modal open={editing} onClose={() => setEditing(false)} label="Edit the squad" title={data.name}>
        <Field label="Name — unique within the sport" htmlFor="team-name">
          <input id="team-name" value={name} onChange={e => setName(e.target.value)} />
        </Field>
        {/* backend ยังไม่มีคอลัมน์รหัสทีม (updateTeamSchema รับแค่ name) — แก้ได้เฉพาะโหมด mock */}
        {USE_MOCK ? (
          <Field label="Short code — 2 or 3 letters or digits" htmlFor="team-code">
            <input id="team-code" value={code} maxLength={3} onChange={e => setCode(e.target.value.toUpperCase())} />
          </Field>
        ) : null}
        {!codeOk ? <span className="sub">The code needs 2 or 3 letters or digits.</span> : null}
        {details.isError ? <Banner kind="crit">{errorMessage(details.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn primary" type="button"
            disabled={!name.trim() || !codeOk || !changed || details.isPending} onClick={saveEdit}>
            {details.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal open={asking} onClose={() => setAsking(false)} label="Ask an admin" title={`Official status for ${data.name}`}>
        <div className="sub">
          For standing clubs, not for squads avoiding the deadline. An admin decides, and checks that no
          member already plays for another Official squad in this sport.
        </div>
        <Field label="Supporting documents — one link or reference per line" htmlFor="official-docs">
          <textarea id="official-docs" rows={3} value={docs} onChange={e => setDocs(e.target.value)}
            placeholder="Club registration letter 2026" />
        </Field>
        {official.isError ? <Banner kind="crit">{errorMessage(official.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setAsking(false)}>Cancel</button>
          <button className="btn primary" type="button" disabled={!docList.length || official.isPending}
            onClick={() => official.mutate({ supportingDocs: docList }, {
              onSuccess: () => {
                setAsking(false)
                setDocs('')
                setNotice('Sent to an admin — Official status is a judgement, not a checkbox.')
              },
            })}>
            {official.isPending ? 'Sending…' : 'Send to an admin'}
          </button>
        </div>
      </Modal>

      <Modal open={disbanding} onClose={() => setDisbanding(false)}
        label="Destructive — read it before you answer" title={`Disband ${data.name}?`}>
        <ConfirmCard danger ok="Disband" onCancel={() => setDisbanding(false)}
          body="Every member loses the squad. Only a squad that has never held a place in a tournament can be disbanded."
          onConfirm={() => {
            setDisbanding(false)
            disband.mutate(undefined, { onSuccess: () => navigate('/teams') })
          }} />
      </Modal>
    </Panel>
  )
}
