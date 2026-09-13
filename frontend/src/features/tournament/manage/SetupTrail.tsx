/**
 * src/features/tournament/manage/SetupTrail.tsx
 *
 * The organizer's job is a sequence and the manage tab states it, drawn with the
 * same trail a match result uses: appoint the referees → open it to the public →
 * approve the squads → draw the bracket → set every fixture → results come in.
 *
 * Each step carries its own count, exactly one is lit, and only the lit step
 * carries a button. A step whose action would be refused says so instead of
 * offering a button that would bounce. Every step is derived on render.
 *
 * ── id ที่ส่งให้ API ──────────────────────────────────────────────────────
 * ส่ง id ที่หน้าถืออยู่ตรงๆ — เดิมแปลงด้วย Number() ซึ่งได้ NaN กับ id ของ store
 * ('t-bkb') ปุ่ม Open to public กับ Generate bracket จึงกดแล้วเงียบ ไม่มีอะไรเกิดขึ้น
 */
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Panel, Trail } from '../../../components/kit/primitives'
import type { TrailStep } from '../../../components/kit/primitives'
import { useLtms } from '../../../shared/store'
import { useDrawTournament, usePublishTournament, useTournament } from '../../../hooks/useTournament'
import { useTournamentReferees } from '../../../hooks/useAdmin'
import { matchesOf, regsOf, team } from '../../../shared/selectors'
import { formatName, refsNeeded } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'

export function SetupTrail({ t, onAppoint }: { t: Tournament; onAppoint: () => void }) {
  const s = useLtms()
  const navigate = useNavigate()
  const publish = usePublishTournament(t.id)
  const draw = useDrawTournament(t.id)
  const need = refsNeeded(t)
  const { data: referees, isError: refereesError } = useTournamentReferees(t.id)

  /* id ตัวเลข → ใช้ applications จาก API · id string (prototype) → ใช้ store */
  const tournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const { data: detail } = useTournament(tournamentId)
  const apiApps = detail?.applications
  const approved = apiApps
    ? apiApps.filter(a => a.status === 'approved')
    : regsOf(s, t.id).filter(r => r.status === 'approved')
  const pend = apiApps
    ? apiApps.filter(a => a.status === 'pending')
    : regsOf(s, t.id).filter(r => r.status === 'pending')

  const ms = t.drawn ? matchesOf(s, t.id).filter(m => m.note !== 'bye' && m.status !== 'void') : []
  const ready = ms.filter(m => m.venue && (m.refs || []).length >= need)
  const done = ms.filter(m => m.status === 'confirmed')

  /* ยอดตอบรับมาจาก acceptedCount ของ GET /tournaments/:id/referees (FEAT-1-REMAINING)
     ระหว่างโหลดยังไม่รู้ จึงบอกว่ากำลังตรวจ ไม่เดาจาก store */
  const acceptedRefs = referees?.acceptedCount
  const steps: TrailStep[] = [
    {
      state: acceptedRefs !== undefined && acceptedRefs >= need ? 'done' : 'idle',
      title: 'Appoint the referees',
      note: refereesError ? 'The referee count is unavailable right now.'
        : acceptedRefs === undefined ? 'Checking how many referees have accepted…'
          : `${acceptedRefs} of ${need} accepted. An invitation counts only once it is answered.`,
      cta: <button className="btn primary" type="button" onClick={onAppoint}>Appoint a referee</button>,
    },
    {
      state: t.status === 'public' ? 'done' : 'idle',
      title: 'Open it to the public',
      note: t.status === 'public' ? 'Squads can find it and enter.'
        : t.status === 'pending' ? 'An admin has the request. Nothing to do until they answer it.'
          : 'Nobody can register while it is private, and LTMS deletes a private tournament on its match date.',
      cta: t.status === 'private'
        ? (
          <button className="btn primary" type="button" disabled={publish.isPending} onClick={() => publish.mutate()}>
            {publish.isPending ? 'Opening…' : 'Open to public'}
          </button>
        )
        : undefined,
    },
    {
      state: approved.length >= 2 ? 'done' : 'idle',
      title: 'Approve the squads',
      note: `${approved.length} approved · ${pend.length} waiting on you · cap ${t.cap}. The hard filter has already refused anybody ineligible.`,
    },
    {
      state: t.drawn ? 'done' : 'idle',
      title: 'Draw the bracket',
      note: t.drawn
        ? `${formatName(t)} — drawn, so entry is closed.`
        : `${formatName(t)} — needs two approved squads, and closes entry for good.`,
      cta: (
        <button className="btn primary" type="button" disabled={draw.isPending} onClick={() => draw.mutate({})}>
          {draw.isPending ? 'Drawing…' : 'Generate bracket · random draw'}
        </button>
      ),
    },
    {
      state: ms.length > 0 && ready.length === ms.length ? 'done' : 'idle',
      title: 'Set every fixture',
      note: ms.length
        ? `${ready.length} of ${ms.length} have a venue and their officials on them.`
        : 'Kick-off, venue and the officials, one match at a time.',
      cta: <button className="btn primary" type="button" onClick={() => navigate(`/t/${t.id}/schedule`)}>Open the schedule</button>,
    },
    {
      state: t.champion ? 'done' : 'idle',
      title: 'Results come in',
      note: t.champion ? `${team(s, t.champion)?.name ?? 'Somebody'} won it.`
        : ms.length ? `${done.length} of ${ms.length} confirmed. A dispute lands back with you.`
          : 'Referees record, leaders confirm, and a dispute lands back with you.',
    },
  ]

  const now = steps.findIndex(x => x.state !== 'done')
  steps.forEach((x, i) => {
    if (x.state !== 'done') x.state = i === now ? 'now' : 'idle'
    if (i !== now) x.cta = undefined
  })

  return (
    <Panel>
      <div className="spread">
        <span className="tag"><em>//</em> Running this tournament — where you are</span>
        {now < 0 ? <Badge kind="ok">Every step done</Badge> : <Badge kind="warn">{`Step ${now + 1} of ${steps.length}`}</Badge>}
      </div>
      {publish.isError ? <Banner kind="crit"><b>Couldn't open it to the public.</b> {errorMessage(publish.error)}</Banner> : null}
      {draw.isError ? <Banner kind="crit"><b>Couldn't draw the bracket.</b> {errorMessage(draw.error)}</Banner> : null}
      <Trail steps={steps} />
    </Panel>
  )
}
