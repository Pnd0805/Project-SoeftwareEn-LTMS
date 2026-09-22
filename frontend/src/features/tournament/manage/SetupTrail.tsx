/**
 * src/features/tournament/manage/SetupTrail.tsx
 *
 * The organizer's job is a sequence and the manage tab states it, drawn with the
 * same trail a match result uses: appoint the referees → publish → open registration →
 * approve the squads → draw/redraw → set every fixture → results come in.
 *
 * Each step carries its own count, exactly one is lit, and only the lit step
 * carries a button. A step whose action would be refused says so instead of
 * offering a button that would bounce. Every step is derived on render.
 *
 * ── id ที่ส่งให้ API ──────────────────────────────────────────────────────
 * ส่ง id ที่หน้าถืออยู่ตรงๆ — เดิมแปลงด้วย Number() ซึ่งได้ NaN กับ id ของ store
 * ('t-bkb') ปุ่ม Open to public กับ Generate bracket จึงกดแล้วเงียบ ไม่มีอะไรเกิดขึ้น
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Panel, Trail } from '../../../components/kit/primitives'
import { ConfirmCard, Modal } from '../../../components/kit/Modal'
import type { TrailStep } from '../../../components/kit/primitives'
import { useLtms } from '../../../shared/store'
import {
  useCompleteTournament, useDrawTournament, useOpenTournamentRegistration, usePublishTournament,
  useTournamentApplications, useTournamentTeams,
} from '../../../hooks/useTournament'
import { useTournamentMatches } from '../../../hooks/useMatch'
import { useTournamentReferees } from '../../../hooks/useAdmin'
import { matchesOf, regsOf, team } from '../../../shared/selectors'
import { formatName, refsNeeded } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'
const errorCode = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error
  ? String((error as { code?: unknown }).code ?? '') : ''
const unfinishedMatches = (error: unknown): Array<{ id: number; status: string }> => {
  if (typeof error !== 'object' || error === null || !('extra' in error)) return []
  const matches = (error as { extra?: { matches?: unknown } }).extra?.matches
  return Array.isArray(matches)
    ? matches.filter((match): match is { id: number; status: string } => (
        typeof match === 'object' && match !== null
        && typeof (match as { id?: unknown }).id === 'number'
        && typeof (match as { status?: unknown }).status === 'string'
      ))
    : []
}

export function SetupTrail({ t, onAppoint }: { t: Tournament; onAppoint: () => void }) {
  const s = useLtms()
  const navigate = useNavigate()
  const publish = usePublishTournament(t.id)
  const draw = useDrawTournament(t.id)
  const need = refsNeeded(t)
  /* สองขั้นนี้ย้อนกลับไม่ได้ — เปิดสาธารณะแล้วคนเห็นทันที จับสายแล้วปิดรับสมัครถาวร
     เดิมกดปุ๊บทำปุ๊บ ไม่ถามอะไรเลย */
  const [confirming, setConfirming] = useState<'publish' | 'draw' | null>(null)
  const { data: referees, isError: refereesError } = useTournamentReferees(t.id)

  /* id ตัวเลข → อ่านจาก backend · id string (prototype) → อ่านจาก store
     ⚠️ เดิมอ่าน useTournament(id).applications ซึ่ง backend ไม่เคยส่งมาเลย
        ทุกอย่างจึงตกไป regsOf(store) ที่ว่างเปล่าในโหมดจริง แถบนี้เลยค้างอยู่ที่
        "0 approved · 0 waiting on you" ตลอด ทั้งที่อนุมัติทีมครบและแข่งจบไปแล้ว */
  const tournamentId = Number.isInteger(Number(t.id)) ? Number(t.id) : undefined
  const real = tournamentId !== undefined
  const complete = useCompleteTournament(tournamentId ?? 0)
  const openRegistration = useOpenTournamentRegistration(tournamentId ?? 0)
  const approvedTeams = useTournamentTeams(tournamentId)
  const applications = useTournamentApplications(tournamentId)
  const backendMatches = useTournamentMatches(tournamentId)

  const approvedCount = real
    ? approvedTeams.data?.items.length ?? 0
    : regsOf(s, t.id).filter(r => r.status === 'approved').length
  const pendingCount = real
    ? (applications.data?.items ?? []).filter(a => a.status === 'pending').length
    : regsOf(s, t.id).filter(r => r.status === 'pending').length
  const applicationCount = real ? applications.data?.items.length ?? 0 : regsOf(s, t.id).length

  /* บายไม่ใช่แมตช์ที่ต้องจัดสนามหรือหากรรมการ — ฝั่ง backend คือนัดที่มีทีมเดียว */
  const apiMatches = (backendMatches.data?.items ?? []).filter(m => m.teamA && m.teamB)
  const bracketDrawn = real ? (backendMatches.data?.items.length ?? 0) > 0 : t.drawn
  const ms = real ? apiMatches
    : t.drawn ? matchesOf(s, t.id).filter(m => m.note !== 'bye' && m.status !== 'void') : []
  const ready = real
    ? apiMatches.filter(m => m.venue && m.scheduledTime)
    : (ms as ReturnType<typeof matchesOf>).filter(m => m.venue && (m.refs || []).length >= need)
  const done = real
    ? apiMatches.filter(m => m.status === 'completed')
    : (ms as ReturnType<typeof matchesOf>).filter(m => m.status === 'confirmed')
  /* backend ไม่มีทางปิดรายการ (ดู FEAT-1-REMAINING) — "จบแล้ว" คือทุกนัดยืนยันผลครบ
     ไม่ใช่ t.champion ที่ tournamentView เดาจากวันแข่งที่ผ่านไปแล้ว */
  const allPlayed = real ? ms.length > 0 && done.length === ms.length : !!t.champion

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
      note: t.status === 'public' ? 'Squads can find it. Registration is controlled separately.'
        : t.status === 'pending' ? 'An admin has the request. Nothing to do until they answer it.'
          : 'Nobody can register while it is private, and LTMS deletes a private tournament on its match date.',
      cta: t.status === 'private'
        ? (
          <button className="btn primary" type="button" disabled={publish.isPending}
            onClick={() => setConfirming('publish')}>
            {publish.isPending ? 'Opening…' : 'Open to public'}
          </button>
        )
        : undefined,
    },
    ...(real ? [{
      state: (t.registrationOpen || applicationCount > 0 || approvedCount > 0 || bracketDrawn) ? 'done' as const : 'idle' as const,
      title: 'Open registration',
      note: t.registrationOpen
        ? 'Squads can submit applications now.'
        : applicationCount > 0 || approvedCount > 0 || bracketDrawn
          ? 'Registration was opened and is now closed.'
          : 'Publishing makes the tournament visible, but does not let squads apply until registration is opened.',
      cta: t.status === 'public' && !t.registrationOpen ? (
        <button className="btn primary" type="button" disabled={openRegistration.isPending}
          onClick={() => openRegistration.mutate()}>
          {openRegistration.isPending ? 'Opening registration…' : 'Open registration'}
        </button>
      ) : undefined,
    }] : []),
    {
      state: approvedCount >= 2 ? 'done' : 'idle',
      title: 'Approve the squads',
      note: `${approvedCount} approved · ${pendingCount} waiting on you · cap ${t.cap}. Registration may remain open; redraw uses the currently approved squads until matches are in use.`,
    },
    {
      state: bracketDrawn ? 'done' : 'idle',
      title: 'Draw the bracket',
      note: real && backendMatches.isPending
        ? 'Checking the saved bracket…'
        : real && backendMatches.isError
          ? 'The saved bracket could not be checked. Try again before drawing.'
          : bracketDrawn
            ? `${formatName(t)} — the saved matches confirm that the bracket is drawn.`
            : `${formatName(t)} — needs two approved squads.`,
      cta: (
        <button className="btn primary" type="button"
          disabled={draw.isPending || (real && (backendMatches.isPending || backendMatches.isError))}
          onClick={() => setConfirming('draw')}>
          {draw.isPending ? 'Drawing…' : 'Generate bracket · random draw'}
        </button>
      ),
    },
    {
      state: ms.length > 0 && ready.length === ms.length ? 'done' : 'idle',
      title: 'Set every fixture',
      note: ms.length
        ? `${ready.length} of ${ms.length} have a kick-off and a venue on them.`
        : 'Kick-off, venue and the officials, one match at a time.',
      cta: <button className="btn primary" type="button" onClick={() => navigate(`/t/${t.id}/schedule`)}>Open the schedule</button>,
    },
    {
      state: allPlayed ? 'done' : 'idle',
      title: 'Results come in',
      note: ms.length
        ? `${done.length} of ${ms.length} confirmed. A dispute lands back with you.`
        : !real && t.champion ? `${team(s, t.champion)?.name ?? 'Somebody'} won it.`
          : 'Referees record, leaders confirm, and a dispute lands back with you.',
    },
    ...(real ? [{
      state: 'idle' as const,
      title: 'Close the tournament',
      note: allPlayed
        ? 'Close explicitly to publish the final winner and lock every write except announcements.'
        : 'Every match must be completed before the tournament can be closed.',
      cta: allPlayed ? (
        <button className="btn primary" type="button" disabled={complete.isPending}
          onClick={() => complete.mutate()}>
          {complete.isPending ? 'Closing…' : 'Close tournament'}
        </button>
      ) : undefined,
    }] : []),
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
      <Modal open={confirming !== null} onClose={() => setConfirming(null)}
        label={confirming === 'draw' ? 'Draw the bracket' : 'Open to the public'} title={t.name}>
        {confirming === 'draw' ? (
          <ConfirmCard danger ok="Draw it" onCancel={() => setConfirming(null)}
            onConfirm={() => { setConfirming(null); draw.mutate({}) }}
            body={<>
              <b>This creates the tournament matches.</b> {formatName(t)} is drawn from the {approvedCount} squads
              approved so far. If the approved field changes before play starts, the bracket can be replaced atomically
              from the Draw tab.
            </>} />
        ) : (
          <ConfirmCard ok="Open it" onCancel={() => setConfirming(null)}
            onConfirm={() => { setConfirming(null); publish.mutate() }}
            body={<>
              Everybody will be able to find <b>{t.name}</b>. Registration stays closed until the
              separate Open registration step, so check the entry rules and dates before opening it.
            </>} />
        )}
      </Modal>

      {publish.isError ? <Banner kind="crit"><b>Couldn't open it to the public.</b> {errorMessage(publish.error)}</Banner> : null}
      {openRegistration.isError ? <Banner kind="crit"><b>Couldn't open registration.</b> {errorMessage(openRegistration.error)}</Banner> : null}
      {draw.isPending ? <Banner kind="neutral"><b>Drawing the bracket…</b> Refreshing the saved matches before progress advances.</Banner> : null}
      {draw.isError ? <Banner kind="crit"><b>Couldn't draw the bracket.</b> {errorMessage(draw.error)}</Banner> : null}
      {complete.isError ? (
        <Banner kind="crit">
          <b>Couldn't close the tournament.</b>{' '}
          {errorCode(complete.error) === 'MATCHES_UNFINISHED'
            ? <>Finish these matches first: {unfinishedMatches(complete.error).map(match => `#${match.id} (${match.status})`).join(', ') || 'the server did not provide the list'}.</>
            : errorCode(complete.error) === 'NO_MATCHES'
              ? 'Draw the bracket before closing the tournament.'
              : errorCode(complete.error) === 'TOURNAMENT_COMPLETED'
                ? 'This tournament has already been closed. Refresh to see the final state.'
                : errorMessage(complete.error)}
        </Banner>
      ) : null}
      <Trail steps={steps} />
    </Panel>
  )
}
