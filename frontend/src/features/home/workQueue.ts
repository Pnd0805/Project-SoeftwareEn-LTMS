/**
 * src/features/home/workQueue.ts
 *
 * "Needs you" — everything outstanding across every role a User holds, derived
 * on every render rather than stored, so it can never disagree with the state it
 * describes.
 *
 * Steam opens on what you can act on. This app hands one person five hats and
 * would otherwise scatter their work across five pages: an organizer has to
 * remember to look at Manage, a referee at Matches, a leader at Teams. So the
 * work comes to the front page instead, one line per thing.
 */
import { matchStage, refsNeeded, winnerId } from '../../shared/rules'
import { ledTeams, matchesOf, me, regsOf, tour } from '../../shared/selectors'
import type { State } from '../../shared/types'

export type WorkKind = 'crit' | 'warn' | 'ok'
export interface WorkItem { label: string; sub: string; href: string }
export interface WorkEntry { kind: WorkKind; what: string; where: string; href: string; items: WorkItem[] }

export function workQueue(s: State): WorkEntry[] {
  const u = me(s)
  if (!u) return []
  const q: WorkEntry[] = []
  const named = (id?: string | null) => s.teams.find(t => t.id === id)?.name ?? 'TBD'

  /* organising */
  s.tournaments.filter(t => t.organizer === u.id).forEach(t => {
    const ms = matchesOf(s, t.id)

    const disputed = ms.filter(m => m.status === 'disputed')
    if (disputed.length) q.push({
      kind: 'crit',
      what: `${disputed.length} disputed result${disputed.length === 1 ? '' : 's'} to settle`,
      where: `${t.name} · your decision is final`,
      href: `/m/${disputed[0].id}`,
      items: disputed.map(m => ({ label: matchStage(s, m), sub: `${named(m.a)} vs ${named(m.b)}`, href: `/m/${m.id}` })),
    })

    const pend = regsOf(s, t.id).filter(r => r.status === 'pending')
    if (pend.length) q.push({
      kind: 'warn',
      what: `${pend.length} squad${pend.length === 1 ? '' : 's'} to review`,
      where: `${t.name} · soft filter`,
      href: `/t/${t.id}/manage/registrations`,
      items: pend.map(r => ({ label: named(r.team), sub: 'waiting on you', href: `/t/${t.id}/manage/registrations` })),
    })

    const wd = regsOf(s, t.id).filter(r => r.withdrawRequested)
    if (wd.length) q.push({
      kind: 'warn',
      what: `${wd.length} withdrawal request${wd.length === 1 ? '' : 's'}`,
      where: `${t.name} · the bracket is live`,
      href: `/t/${t.id}/manage/registrations`,
      items: wd.map(r => ({ label: named(r.team), sub: 'withdrawal request', href: `/t/${t.id}/manage/registrations` })),
    })

    if (t.status === 'private') {
      const need = refsNeeded(t), got = (t.referees || []).length
      q.push(got >= need
        ? {
          kind: 'ok', what: 'Ready to publish', where: `${t.name} · ${got} of ${need} referees accepted`,
          href: `/t/${t.id}/manage/progress`,
          items: [{ label: t.name, sub: 'publish from Progress', href: `/t/${t.id}/manage/progress` }],
        }
        : {
          kind: 'warn',
          what: `${need - got} more referee${need - got === 1 ? '' : 's'} to appoint`,
          where: `${t.name} · it cannot go public without them`,
          href: `/t/${t.id}/manage/referees`,
          items: [{ label: t.name, sub: `${got} of ${need} accepted`, href: `/t/${t.id}/manage/referees` }],
        })
    }

    const approved = regsOf(s, t.id).filter(r => r.status === 'approved').length
    if (t.status === 'public' && !t.drawn && approved >= 2) q.push({
      kind: 'ok', what: 'Ready to draw', where: `${t.name} · ${approved} squads approved`,
      href: `/t/${t.id}/manage/draw`,
      items: [{ label: t.name, sub: `${approved} squads approved`, href: `/t/${t.id}/manage/draw` }],
    })
  })

  /* officiating — only an assigned referee may record a match */
  const refWork = s.matches.filter(m => (m.refs || []).includes(u.id) && m.a && m.b && m.status !== 'confirmed')
  const toEnter = refWork.filter(m => m.status === 'scheduled' && tour(s, m.tour)?.channel === 'onsite')
  const toConfirm = refWork.filter(m => m.status === 'pending' && tour(s, m.tour)?.channel === 'online')
  if (toEnter.length) q.push({
    kind: 'warn', what: `${toEnter.length} result${toEnter.length === 1 ? '' : 's'} to record`,
    where: `you are officiating · ${tour(s, toEnter[0].tour)?.name}`,
    href: `/m/${toEnter[0].id}`,
    items: toEnter.map(m => ({ label: matchStage(s, m), sub: tour(s, m.tour)?.name ?? '', href: `/m/${m.id}` })),
  })
  if (toConfirm.length) q.push({
    kind: 'warn', what: `${toConfirm.length} submitted result${toConfirm.length === 1 ? '' : 's'} to check and confirm`,
    where: `you are officiating · ${tour(s, toConfirm[0].tour)?.name}`,
    href: `/m/${toConfirm[0].id}`,
    items: toConfirm.map(m => ({ label: matchStage(s, m), sub: tour(s, m.tour)?.name ?? '', href: `/m/${m.id}` })),
  })
  const refInv = s.refInvites.filter(i => i.user === u.id && i.status === 'pending')
  if (refInv.length) q.push({
    kind: 'warn', what: `${refInv.length} appointment${refInv.length === 1 ? '' : 's'} to answer`,
    where: 'an organizer asked you to officiate', href: '/matches',
    items: refInv.map(i => ({ label: tour(s, i.tour)?.name ?? '—', sub: 'officiate invitation', href: '/matches' })),
  })

  /* playing */
  const myLed = ledTeams(s).map(t => t.id)
  const toSign = s.matches.filter(m => m.status === 'pending' && tour(s, m.tour)?.channel === 'onsite'
    && m.a && m.b && myLed.includes(winnerId(m) ?? ''))
  if (toSign.length) q.push({
    kind: 'warn', what: `${toSign.length} result${toSign.length === 1 ? '' : 's'} to confirm`,
    where: 'you won — the losing side disputes instead', href: `/m/${toSign[0].id}`,
    items: toSign.map(m => ({ label: matchStage(s, m), sub: tour(s, m.tour)?.name ?? '', href: `/m/${m.id}` })),
  })
  const inv = s.invites.filter(i => i.user === u.id && i.status === 'pending')
  if (inv.length) q.push({
    kind: 'warn', what: `${inv.length} squad invitation${inv.length === 1 ? '' : 's'} waiting on you`,
    where: 'accepting shares your eligibility data with an organizer', href: '/teams',
    items: inv.map(i => ({ label: named(i.team), sub: 'squad invitation', href: '/teams' })),
  })

  /* admin */
  if (u.role === 'Admin') {
    const req = s.tournaments.filter(t => t.status === 'pending')
    if (req.length) q.push({
      kind: 'crit', what: `${req.length} request${req.length === 1 ? '' : 's'} to organize`,
      where: 'waiting on your approval', href: '/admin',
      items: req.map(t => ({ label: t.name, sub: s.users.find(x => x.id === t.organizer)?.name ?? '—', href: '/admin' })),
    })
    const perm = s.permanentRequests.filter(r => r.status === 'pending')
    if (perm.length) q.push({
      kind: 'warn', what: `${perm.length} permanent-squad request${perm.length === 1 ? '' : 's'}`,
      where: 'exemption is a judgement, not a checkbox', href: '/admin',
      items: perm.map(r => ({ label: named(r.team), sub: 'permanent squad', href: '/admin' })),
    })
  }
  return q
}
