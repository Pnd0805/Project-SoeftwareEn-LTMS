/**
 * src/features/request/RequestPage.tsx
 *
 * Requesting a tournament is one form in four groups: what it is, when entry is
 * open, how long it runs, and who may enter. The entry conditions are set here
 * and only here — after an admin approves them, changing them means asking again
 * with a reason.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { requestTournament, useLtms } from '../../shared/store'
import { me } from '../../shared/selectors'
import { FACULTIES, FORMATS, MAJORS, SPORTS, parsePin, ruleSummary } from '../../shared/rules'
import type { Format, Rules } from '../../shared/types'

export function RequestPage() {
  const s = useLtms()
  const u = me(s)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [sport, setSport] = useState(SPORTS[0])
  const [format, setFormat] = useState<Format>('single')
  const [channel, setChannel] = useState<'onsite' | 'online'>('onsite')
  const [venue, setVenue] = useState('')
  const [pinText, setPinText] = useState('')
  const [date, setDate] = useState('2026-04-01')
  const [cap, setCap] = useState(8)
  const [notes, setNotes] = useState('')
  const [rules, setRules] = useState<Rules>({ gender: 'any', ageMin: 'any', ageMax: 'any', faculty: 'any', major: 'any', year: 'any' })

  if (!u) return null
  const set = (patch: Partial<Rules>) => setRules(r => ({ ...r, ...patch }))

  const submit = () => {
    const id = requestTournament({
      name: name.trim(), sport, format, channel, date, venue: venue.trim(),
      pin: parsePin(pinText), cap, organizer: u.id, rules, entryNotes: notes.trim(),
      drawnAt: undefined, filterChangeRequest: null,
    })
    navigate(`/t/${id}`)
  }

  return (
    <>
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> An admin decides</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>Request a tournament</h1>
        </div>
      </div>

      <div className="split">
        <div>
          <Panel>
            <span className="tag"><em>//</em> What it is</span>
            <Field label="Name" htmlFor="rq-name">
              <input id="rq-name" value={name} onChange={e => setName(e.target.value)} placeholder="Faculty Football Cup 2026" />
            </Field>
            <div className="grid2">
              <Field label="Sport" htmlFor="rq-sport">
                <select id="rq-sport" value={sport} onChange={e => setSport(e.target.value)}>
                  {SPORTS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Format — fixed once the draw is made" htmlFor="rq-format">
                <select id="rq-format" value={format} onChange={e => setFormat(e.target.value as Format)}>
                  {(Object.keys(FORMATS) as Format[]).map(f => <option key={f} value={f}>{FORMATS[f]}</option>)}
                </select>
              </Field>
              <Field label="Played" htmlFor="rq-channel">
                <select id="rq-channel" value={channel} onChange={e => setChannel(e.target.value as 'onsite' | 'online')}>
                  <option value="onsite">On-site — two referees per match</option>
                  <option value="online">Online — one referee per match</option>
                </select>
              </Field>
              <Field label="Squad cap" htmlFor="rq-cap">
                <input id="rq-cap" type="number" min={2} max={64} value={cap} onChange={e => setCap(Number(e.target.value))} />
              </Field>
            </div>
          </Panel>

          <Panel>
            <span className="tag"><em>//</em> When and where</span>
            <div className="grid2">
              <Field label="First match date" htmlFor="rq-date">
                <input id="rq-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </Field>
              <Field label="Default venue" htmlFor="rq-venue">
                <input id="rq-venue" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Main Stadium" />
              </Field>
            </div>
            <Field label="Map pin — paste a Google Maps link, or lat, lng" htmlFor="rq-pin">
              <input id="rq-pin" value={pinText} onChange={e => setPinText(e.target.value)} placeholder="13.7367, 100.5232" />
            </Field>
            <span className="sub">
              Stored as coordinates and rendered as a link out to Google Maps, never an embedded map.
              An online match has no venue.
            </span>
          </Panel>

          <Panel>
            <span className="tag"><em>//</em> Who may enter — the hard filter</span>
            <Banner kind="warn">
              <b>Every condition is optional, and every one you set is enforced with no override.</b>{' '}
              A squad with one failing player is rejected outright, and after approval these can only be
              changed by asking an admin again.
            </Banner>
            <div className="grid2">
              <Field label="Gender" htmlFor="rq-gender">
                <select id="rq-gender" value={rules.gender} onChange={e => set({ gender: e.target.value as Rules['gender'] })}>
                  <option value="any">Any</option><option value="Male">Male</option><option value="Female">Female</option>
                </select>
              </Field>
              <Field label="Year of study" htmlFor="rq-year">
                <select id="rq-year" value={String(rules.year)} onChange={e => set({ year: e.target.value === 'any' ? 'any' : Number(e.target.value) })}>
                  <option value="any">Any</option>{[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Minimum age" htmlFor="rq-lo">
                <input id="rq-lo" value={String(rules.ageMin)} onChange={e => set({ ageMin: e.target.value === 'any' || !e.target.value ? 'any' : Number(e.target.value) })} />
              </Field>
              <Field label="Maximum age" htmlFor="rq-hi">
                <input id="rq-hi" value={String(rules.ageMax)} onChange={e => set({ ageMax: e.target.value === 'any' || !e.target.value ? 'any' : Number(e.target.value) })} />
              </Field>
              <Field label="Faculty" htmlFor="rq-fac">
                <select id="rq-fac" value={rules.faculty} onChange={e => set({ faculty: e.target.value })}>
                  <option value="any">Any</option>{FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Major" htmlFor="rq-maj">
                <select id="rq-maj" value={rules.major} onChange={e => set({ major: e.target.value })}>
                  <option value="any">Any</option>{MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel>
            <span className="tag"><em>//</em> Entry notes — the soft filter</span>
            <Field label="What you expect beyond the hard filter" htmlFor="rq-notes">
              <textarea id="rq-notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Kit, paperwork, conduct — anything the entry rules cannot express as a field." />
            </Field>
            <span className="sub">The system never checks these; it only shows them. You read them when you review a squad.</span>
          </Panel>

          <div className="hstack">
            <button className="btn" type="button" onClick={() => navigate('/')}>Cancel</button>
            <button className="btn primary" type="button" disabled={!name.trim() || !venue.trim()} onClick={submit}>
              Send the request
            </button>
          </div>
        </div>

        <div className="rail">
          <Panel quiet>
            <span className="tag"><em>//</em> What happens next</span>
            <div className="sub">
              An admin approves or declines it. Approved, it arrives as your <b>Private</b> draft: appoint
              the referees, then open it to the public. LTMS deletes a private tournament on its match date.
            </div>
            <span className="tag"><em>//</em> Entry conditions as they read now</span>
            <div style={{ fontSize: 15 }}>{ruleSummary(rules) || 'Open to everybody'}</div>
          </Panel>
        </div>
      </div>
    </>
  )
}
