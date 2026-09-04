/**
 * src/features/team/TeamsPage.tsx
 *
 * Your squads, and the invitations waiting on you. Adding a Player creates an
 * Invitation, never a membership — accepting is what exposes that player's
 * eligibility data to an organizer, so the banner says so before they click.
 */
import { useState } from 'react'
import { Badge, Banner, Empty, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Modal, ConfirmCard } from '../../components/kit/Modal'
import { PlayerLink, TeamCrestView, TeamMarkView } from '../../components/kit/chips'
import { toTeamView } from '../../components/kit/viewModels'
import {
  answerInvite, createTeam, disbandTeam, invitePlayer, kickPlayer, requestPermanent, requestWithdraw,
  transferLeader, useLtms,
} from '../../shared/store'
import { ledTeams, me, myTeams, openToEnter, team, tour, user } from '../../shared/selectors'
import { SPORTS, minSquad, teamReady } from '../../shared/rules'
import type { Team } from '../../shared/types'
import { RegisterForm } from '../tournament/RegisterForm'
import { useUpdateTeam } from '../../hooks/useTeam'
import { IMAGE_ACCEPT, shrinkImage } from '../../mocks/imageInput'

function CreateTeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useLtms()
  const u = me(s)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [sport, setSport] = useState(SPORTS[0])
  return (
    <Modal open={open} onClose={onClose} label="Create a team" title="A squad names its sport when it is created">
      <div className="sub">The minimum size follows from the sport — a five-a-side squad is not judged by an eleven-a-side rule.</div>
      <Field label="Name" htmlFor="nt-name"><input id="nt-name" value={name} onChange={e => setName(e.target.value)} placeholder="Byte Force" /></Field>
      <Field label="Three-letter code" htmlFor="nt-code"><input id="nt-code" maxLength={3} value={code} onChange={e => setCode(e.target.value)} placeholder="BYT" /></Field>
      <Field label="Sport" htmlFor="nt-sport">
        <select id="nt-sport" value={sport} onChange={e => setSport(e.target.value)}>
          {SPORTS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </Field>
      <div className="hstack">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" disabled={!name.trim() || !code.trim() || !u}
          onClick={() => { createTeam({ name: name.trim(), code: code.trim(), sport, color: '#3AAE7C' }, u!.id); onClose() }}>
          Create the squad
        </button>
      </div>
    </Modal>
  )
}

function InviteModal({ tm, open, onClose }: { tm: Team | null; open: boolean; onClose: () => void }) {
  const s = useLtms()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const cands = tm
    ? s.users.filter(x => x.role !== 'Admin' && !tm.members.includes(x.id))
      .filter(x => needle.length > 1 && x.name.toLowerCase().includes(needle)).slice(0, 12)
    : []
  return (
    <Modal open={open} onClose={onClose} label="Invite a player" title={tm?.name}>
      <Field label="Search the roll by name" htmlFor="inv-find">
        <input id="inv-find" value={q} onChange={e => setQ(e.target.value)} placeholder="Start typing a name…" autoComplete="off" />
      </Field>
      {cands.length ? (
        <TableWrap>
          <table>
            <tbody>
              {cands.map(x => (
                <tr key={x.id}>
                  <td><span className="hstack"><span className="avatar">{x.name.slice(0, 1)}</span>{x.name}</span></td>
                  <td className="sub">{x.faculty} · Year {x.year}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn primary" type="button" onClick={() => tm && invitePlayer(tm.id, x.id)}>Invite</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : <div className="sub">{needle.length > 1 ? 'Nobody matches that.' : 'Type at least two letters.'}</div>}
      <div className="hstack"><button className="btn ghost" type="button" onClick={onClose}>Done</button></div>
    </Modal>
  )
}


/**
 * ตั้งหรือถอดโลโก้ทีม (FR-TM-04)
 *
 * แยกเป็นคอมโพเนนต์เพราะการ์ดทีมถูก render ในลูป — เรียก useUpdateTeam ในลูป
 * ของ parent ไม่ได้ ต้องมีคอมโพเนนต์ต่อหนึ่งทีม
 */
function TeamLogoControl({ t }: { t: Team }) {
  const update = useUpdateTeam(t.id)
  const [err, setErr] = useState<string | null>(null)
  const inputId = `logo-${t.id}`

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
    <>
      <input id={inputId} type="file" accept={IMAGE_ACCEPT} style={{ display: 'none' }}
        onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      <label className="btn ghost" htmlFor={inputId} style={{ cursor: 'pointer' }}>
        <Icon name="plus" size={12} /> {t.logo ? 'Change logo' : 'Add a logo'}
      </label>
      {t.logo ? (
        <button className="btn ghost" type="button" disabled={update.isPending}
          onClick={() => update.mutate({ logoUrl: null })}>
          Remove logo
        </button>
      ) : null}
      {err || update.isError ? (
        <span className="sub">{err ?? (update.error as Error).message}</span>
      ) : null}
    </>
  )
}

export function TeamsPage() {
  const s = useLtms()
  const u = me(s)
  const [creating, setCreating] = useState(false)
  const [inviteTo, setInviteTo] = useState<Team | null>(null)
  const [registerFor, setRegisterFor] = useState<Team | null>(null)
  const [disbanding, setDisbanding] = useState<Team | null>(null)
  const [permanentFor, setPermanentFor] = useState<Team | null>(null)
  const [reason, setReason] = useState('')

  if (!u) return null
  const invites = s.invites.filter(i => i.user === u.id && i.status === 'pending')
  const mine = myTeams(s)
  const led = ledTeams(s).map(t => t.id)

  return (
    <>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 32 }}>Teams</h1>
        <button className="btn primary" type="button" onClick={() => setCreating(true)}>
          <Icon name="plus" size={13} /> Create a team
        </button>
      </div>

      {invites.length ? (
        <Panel>
          <span className="tag"><em>//</em> Invitations waiting on you</span>
          {invites.map(i => {
            const tm = team(s, i.team)
            if (!tm) return null
            return (
              <div className="vstack" style={{ gap: 9 }} key={i.id}>
                <div className="hstack">
                  <span className="tchip"><TeamMarkView team={toTeamView(tm)} /><b>{tm.name}</b></span>
                  <span className="sub">{user(s, tm.leader)?.name} invited you</span>
                </div>
                <Banner kind="warn" icon="team">
                  Accepting shares your faculty, year and date of birth with the organizer of any tournament
                  this squad enters — that is how the eligibility check works.
                </Banner>
                <div className="hstack">
                  <button className="btn" type="button" onClick={() => answerInvite(i.id, false)}>Decline</button>
                  <button className="btn primary" type="button" onClick={() => answerInvite(i.id, true)}>Accept invitation</button>
                </div>
              </div>
            )
          })}
        </Panel>
      ) : null}

      {mine.length ? mine.map(t => {
        const ready = teamReady(t)
        const pend = s.invites.filter(i => i.team === t.id && i.status === 'pending')
        const lead = led.includes(t.id)
        const regs = s.registrations.filter(r => r.team === t.id)
        const permanentAsked = s.permanentRequests.some(r => r.team === t.id && r.status === 'pending')
        return (
          <Panel key={t.id}>
            <div className="spread">
              <span className="hstack" style={{ gap: 12 }}>
                <TeamCrestView team={toTeamView(t)} />
                <span className="disp" style={{ fontSize: 21 }}>{t.name}</span>
                <span className="tag">{t.code}</span>
              </span>
              <span className="hstack">
                {t.sport ? <Badge kind="neutral">{t.sport}</Badge> : null}
                {ready ? <Badge kind="ok">Ready</Badge> : <Badge kind="warn">{`Forming · ${t.members.length} of ${minSquad(t)}`}</Badge>}
                <Badge kind="neutral">{lead ? 'You lead this squad' : 'You play here'}</Badge>
              </span>
            </div>

            {!ready ? (
              <Banner kind="warn" icon="team">
                <b>{minSquad(t) - t.members.length} more accepted member{minSquad(t) - t.members.length === 1 ? '' : 's'} and this squad is Ready.</b>{' '}
                {t.sport ? `${t.sport} needs ${minSquad(t)}. ` : ''}A Forming squad can't be registered for anything.
              </Banner>
            ) : null}

            <TableWrap>
              <table>
                <thead>
                  <tr><th>Player</th><th>Faculty</th><th>Year</th><th>Membership</th>{lead ? <th /> : null}</tr>
                </thead>
                <tbody>
                  {t.members.map(id => {
                    const p = user(s, id)
                    if (!p) return null
                    return (
                      <tr key={id}>
                        <td>
                          <span className="hstack">
                            <span className="avatar">{p.name.slice(0, 1)}</span>
                            <PlayerLink id={id} />
                            {t.leader === id ? <span className="tag"> · leader</span> : null}
                          </span>
                        </td>
                        <td className="sub">{p.faculty}</td>
                        <td className="num">{p.year}</td>
                        <td><Badge kind="ok">Accepted</Badge></td>
                        {lead ? (
                          <td>
                            {t.leader === id ? null : (
                              <span className="hstack" style={{ gap: 6 }}>
                                <button className="btn ghost" type="button" onClick={() => kickPlayer(t.id, id)}>Remove</button>
                                <button className="btn ghost" type="button" onClick={() => transferLeader(t.id, id)}>Hand over</button>
                              </span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                  {pend.map(i => {
                    const p = user(s, i.user)
                    if (!p) return null
                    return (
                      <tr key={i.id}>
                        <td>
                          <span className="hstack"><span className="avatar">{p.name.slice(0, 1)}</span><PlayerLink id={i.user} /></span>
                        </td>
                        <td className="sub">{p.faculty}</td>
                        <td className="num">{p.year}</td>
                        <td><Badge kind="warn">Invited</Badge></td>
                        {lead ? <td /> : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>

            {t.permanent ? <div className="hstack"><Badge kind="ok">Permanent — exempt from automatic disabling</Badge></div> : null}
            {!t.permanent && permanentAsked ? <div className="hstack"><Badge kind="warn">Permanent status — with an admin</Badge></div> : null}

            {lead ? (
              <div className="hstack">
                <button className="btn" type="button" onClick={() => setInviteTo(t)}>
                  <Icon name="plus" size={12} /> Invite a player
                </button>
                <TeamLogoControl t={t} />
                <button className="btn primary" type="button" disabled={!ready || t.disabled || !openToEnter(s, t).length}
                  onClick={() => setRegisterFor(t)}>
                  Register for a tournament
                </button>
                {!ready ? <span className="sub">Registration unlocks at {minSquad(t)} members.</span> : null}
                <button className="btn danger" type="button" onClick={() => setDisbanding(t)}>Disband</button>
                {!t.permanent && !permanentAsked
                  ? <button className="btn ghost" type="button" onClick={() => setPermanentFor(t)}>Ask to be permanent</button>
                  : null}
              </div>
            ) : null}

            {regs.length ? (
              <>
                <span className="tag"><em>//</em> Registrations</span>
                <TableWrap>
                  <table>
                    <thead><tr><th>Tournament</th><th>Status</th><th>Note</th><th /></tr></thead>
                    <tbody>
                      {regs.map(r => (
                        <tr key={r.id}>
                          <td>{tour(s, r.tour)?.name}</td>
                          <td>
                            {r.status === 'approved' ? <Badge kind="ok">Approved</Badge>
                              : r.status === 'pending' ? <Badge kind="warn">Awaiting review</Badge>
                                : <Badge kind="crit">{r.status}</Badge>}
                          </td>
                          <td className="sub">{r.reason ?? '—'}</td>
                          <td>
                            {lead && (r.status === 'pending' || r.status === 'approved') && !r.withdrawRequested
                              ? <button className="btn ghost" type="button" onClick={() => requestWithdraw(r.id)}>Withdraw</button>
                              : r.withdrawRequested ? <span className="sub">asked the organizer</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </>
            ) : null}
          </Panel>
        )
      }) : (
        <Empty icon="team" title="You're not in a squad yet" sub="Create one, or wait for an invitation." />
      )}

      <CreateTeamModal open={creating} onClose={() => setCreating(false)} />
      <InviteModal tm={inviteTo} open={!!inviteTo} onClose={() => setInviteTo(null)} />

      {registerFor && openToEnter(s, registerFor).length ? (
        <RegisterForm team={registerFor} options={openToEnter(s, registerFor)}
          tournament={openToEnter(s, registerFor)[0]} open onClose={() => setRegisterFor(null)} />
      ) : null}

      <Modal open={!!disbanding} onClose={() => setDisbanding(null)}
        label="Destructive — read it before you answer" title={`Disband ${disbanding?.name}?`}>
        <ConfirmCard danger ok="Disband" onCancel={() => setDisbanding(null)}
          body="Every member loses the squad and its record goes with it. A squad holding an approved place in a live tournament is locked and cannot be disbanded."
          onConfirm={() => { if (disbanding) disbandTeam(disbanding.id); setDisbanding(null) }} />
      </Modal>

      <Modal open={!!permanentFor} onClose={() => setPermanentFor(null)}
        label="Ask an admin" title={`Permanent status for ${permanentFor?.name}`}>
        <div className="sub">
          For standing clubs, not for squads avoiding the deadline. An admin decides, the same queue as a
          tournament request.
        </div>
        <Field label="Why" htmlFor="pm-why">
          <textarea id="pm-why" rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="We have run since 2019 and enter one tournament a year, in March." />
        </Field>
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setPermanentFor(null)}>Cancel</button>
          <button className="btn primary" type="button"
            onClick={() => { if (permanentFor && u) requestPermanent(permanentFor.id, reason, u.id); setPermanentFor(null); setReason('') }}>
            Send to an admin
          </button>
        </div>
      </Modal>
    </>
  )
}
