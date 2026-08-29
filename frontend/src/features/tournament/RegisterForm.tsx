/**
 * src/features/tournament/RegisterForm.tsx
 *
 * One registration form, two doors — from the tournament page or from a squad.
 * `options` is what the tournament field may still be changed to; a single entry
 * means the choice was made by the door you came in through, so it is stated
 * rather than offered.
 *
 * The Squad list is picked here, and the Hard filter is checked against those
 * players only — a member left off cannot fail it, because they are not entering.
 */
import { useMemo, useState } from 'react'
import { Banner, Field, TableWrap } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { registerSquad, useLtms } from '../../shared/store'
import { user } from '../../shared/selectors'
import { ageOf, hardFilter, regWindowClosed, ruleSummary } from '../../shared/rules'
import type { Team, Tournament } from '../../shared/types'

/** What the organizer wrote about entering — shown, never checked by the system. */
function EntryNotesBlock({ tr }: { tr: Tournament }) {
  const notes = (tr.entryNotes ?? '').trim()
  if (!notes) return null
  return (
    <Banner kind="warn">
      <b>Soft filter from the organizer.</b> The system does not check these — they do, when they review your squad.
      <br />{notes}
    </Banner>
  )
}

export function RegisterForm({ team: tm, options, tournament, open, onClose }: {
  team: Team
  options: Tournament[]
  tournament: Tournament
  open: boolean
  onClose: () => void
}) {
  const s = useLtms()
  const [trId, setTrId] = useState(tournament.id)
  const [squad, setSquad] = useState<string[]>(tm.members)
  const tr = s.tournaments.find(t => t.id === trId) ?? tournament
  const fails = useMemo(() => hardFilter(s, tm, tr, squad), [s, tm, tr, squad])
  const shut = regWindowClosed(tr)
  const locked = options.length < 2

  const toggle = (id: string) =>
    setSquad(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]))

  const submit = () => {
    registerSquad(tr.id, tm.id, squad, fails.length ? fails.map(f => `${f.user.name} — ${f.rule}`).join('; ') : null)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Register ${tm.name}`}>
      {locked ? (
        <Field label="Tournament">
          <div className="sub">{tr.name} — {tr.sport} · {tr.channel}</div>
        </Field>
      ) : (
        <Field label="Tournament" htmlFor="rg-tour">
          <select id="rg-tour" value={trId} onChange={e => setTrId(e.target.value)}>
            {options.map(x => <option key={x.id} value={x.id}>{x.name} — {x.sport}</option>)}
          </select>
        </Field>
      )}

      <span className="tag">
        <em>//</em> Who is entering — the entry rules are checked against these players only
      </span>
      <TableWrap>
        <table>
          <thead><tr><th>In</th><th>Player</th><th>Faculty</th><th>Year</th><th>Age</th></tr></thead>
          <tbody>
            {tm.members.map(id => {
              const u = user(s, id)
              if (!u) return null
              return (
                <tr key={id}>
                  <td>
                    <input type="checkbox" checked={squad.includes(id)} onChange={() => toggle(id)}
                      aria-label={`Enter ${u.name}`} />
                  </td>
                  <td>{u.name}{tm.leader === id ? <span className="tag"> · leader</span> : null}</td>
                  <td className="sub">{u.faculty}</td>
                  <td className="num">{u.year}</td>
                  <td className="num">{ageOf(u.dob)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>

      <EntryNotesBlock tr={tr} />

      {shut ? <Banner kind="crit"><b>{shut}</b></Banner>
        : fails.length ? (
          <Banner kind="crit">
            <b>The hard filter refuses this squad list.</b> Nobody can override it — leave the named players
            off, or enter a different tournament.
            <br />
            {fails.map((f, i) => (
              <span key={i}>{f.user.name} — {f.rule}: needs {String(f.need)}, has {String(f.got)}<br /></span>
            ))}
          </Banner>
        ) : (
          <Banner kind="ok">
            All {squad.length} entering players clear the entry conditions
            {ruleSummary(tr.rules) ? ` (${ruleSummary(tr.rules)})` : ''}. The organizer reviews it next.
          </Banner>
        )}

      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" disabled={!!fails.length || !!shut || !squad.length}
          onClick={submit}>
          Submit registration
        </button>
      </div>
    </Modal>
  )
}
