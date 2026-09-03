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
 */
import { useNavigate } from 'react-router-dom'
import { Badge, Panel, Trail } from '../../../components/kit/primitives'
import type { TrailStep } from '../../../components/kit/primitives'
import { useLtms } from '../../../shared/store'
import { useDrawTournament, usePublishTournament } from '../../../hooks/useTournament'
import { matchesOf, regsOf, team } from '../../../shared/selectors'
import { formatName, refsNeeded } from '../../../shared/rules'
import type { Tournament } from '../../../shared/types'

export function SetupTrail({ t, onAppoint }: { t: Tournament; onAppoint: () => void }) {
  const s = useLtms()
  const navigate = useNavigate()
  const publish = usePublishTournament(Number(t.id))
  const draw = useDrawTournament(Number(t.id))
  const need = refsNeeded(t)
  const approved = regsOf(s, t.id).filter(r => r.status === 'approved')
  const pend = regsOf(s, t.id).filter(r => r.status === 'pending')
  const ms = t.drawn ? matchesOf(s, t.id).filter(m => m.note !== 'bye' && m.status !== 'void') : []
  const ready = ms.filter(m => m.venue && (m.refs || []).length >= need)
  const done = ms.filter(m => m.status === 'confirmed')

  const steps: TrailStep[] = [
    {
      state: (t.referees || []).length >= need ? 'done' : 'idle',
      title: 'Appoint the referees',
      note: `${(t.referees || []).length} of ${need} accepted. An invitation counts only once it is answered.`,
      cta: <button className="btn primary" type="button" onClick={onAppoint}>Appoint a referee</button>,
    },
    {
      state: t.status === 'public' ? 'done' : 'idle',
      title: 'Open it to the public',
      note: t.status === 'public' ? 'Squads can find it and enter.'
        : t.status === 'pending' ? 'An admin has the request. Nothing to do until they answer it.'
          : 'Nobody can register while it is private, and LTMS deletes a private tournament on its match date.',
      cta: t.status === 'private'
        ? <button className="btn primary" type="button" onClick={() => publish.mutate()}>Open to public</button>
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
      cta: <button className="btn primary" type="button" onClick={() => draw.mutate({})}>Generate bracket · random draw</button>,
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
      <Trail steps={steps} />
    </Panel>
  )
}
