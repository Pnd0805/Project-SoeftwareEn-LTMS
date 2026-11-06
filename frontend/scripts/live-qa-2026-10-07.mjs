// Opt-in local integration QA. Requires the existing seeded disposable accounts.
// Does not reset the database or change credentials. Tokens stay in memory.
// Run: LTMS_QA_PASSWORD=<fixture password> node scripts/live-qa-2026-10-07.mjs --write
import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const origin = process.env.LTMS_QA_ORIGIN ?? 'http://127.0.0.1:5193'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('Local QA origin required')
if (!process.argv.includes('--write') || !process.env.LTMS_QA_PASSWORD) throw new Error('Requires --write and LTMS_QA_PASSWORD; writes disposable QA records')
const nativeFetch = globalThis.fetch
globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options)
const storage = new Map()
globalThis.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) }
const results = [], artifacts = {}, cleanup = []
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const client = await server.ssrLoadModule('/src/api/client.ts')
const qa = await server.ssrLoadModule('/src/api/qaFeatures.ts')
assert.equal(client.USE_MOCK, false)
const tokens = {}
const use = role => client.setAccessToken(tokens[role] ?? null)
const api = (path, method = 'GET', body) => client.apiFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
async function check(name, fn) {
  try { await fn(); results.push({ name, result: 'PASS' }); console.log('PASS', name) }
  catch (e) { results.push({ name, result: 'FAIL', status: e.status, code: e.code, message: e.message }); console.log('FAIL', name, e.code ?? e.message) }
}
async function error(fn, status, code) {
  await assert.rejects(fn, e => e.status === status && (!code || e.code === code))
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
try {
  for (const [role,email] of Object.entries({ user: 'mana@ku.th', leader: 'playerA1@ku.th', organizer: 'somying@ku.th', uni: 'somchai@ku.th', root: 'root@ku.th', faculty: 'admin.eng@ku.th', external: 'referee.ext@outside.org', refereeA: 'referee3@ku.th', refereeB: 'referee4@ku.th' })) {
    const response = await api('/auth/login', 'POST', { email, password: process.env.LTMS_QA_PASSWORD })
    tokens[role] = response.accessToken
    use(role)
    await check(`login and /me: ${role}`, async () => assert.ok((await api('/me')).id >= 9000))
  }
  use('guest')
  await check('guest /me rejected', () => error(() => api('/me'), 401))
  await check('server sport capabilities', async () => {
    const { items } = await api('/sport-types')
    assert.ok(items.length); assert.ok(items.every(s => typeof s.supportsBestOf === 'boolean'))
    assert.equal(items.find(s => s.id === 1).supportsBestOf, false)
    assert.equal(items.find(s => s.id === 3).supportsBestOf, true)
  })
  for (const role of ['user','faculty','uni','root']) {
    use(role)
    await check(`report queue scope: ${role}`, async () => {
      if (role === 'user' || role === 'root') return error(() => qa.getUserReports(1), 403)
      assert.ok(Array.isArray((await qa.getUserReports(1)).items))
    })
    await check(`oversight scope: ${role}`, async () => {
      if (role === 'user' || role === 'faculty') return error(() => qa.getStalledWork(), 403)
      assert.equal(typeof (await qa.getStalledWork()).needsAttention, 'boolean')
    })
  }
  use('uni')
  await check('Root suspension protection', () => error(() => api('/admin/users/9099/suspend','PATCH',{ suspended: true, reason: 'Disposable QA guard check', category: 'other', days: 1 }),403,'CANNOT_SUSPEND_ROOT'))
  use('faculty')
  await check('Faculty cannot suspend University Admin', () => error(() => api('/admin/users/9001/suspend','PATCH',{ suspended: true, reason: 'Disposable QA guard check', category: 'other', days: 1 }),403,'INSUFFICIENT_ADMIN_SCOPE'))
  use('user')
  const me = await api('/me'), prefs = await qa.getNotificationPreferences()
  cleanup.push(async () => { use('user'); await api('/me','PATCH',{ contactInfo: me.contactInfo ?? '', address: me.address ?? '', showProfileStats: me.showProfileStats }); await qa.updateNotificationPreference('community', prefs.categories.find(c => c.key === 'community').enabled) })
  await check('profile hidden stats and contact save', async () => {
    await api('/me','PATCH',{ contactInfo: 'Disposable QA contact', address: 'Disposable QA address', showProfileStats: false })
    const saved = await api('/me'); assert.equal(saved.showProfileStats,false); assert.equal(saved.contactInfo,'Disposable QA contact')
  })
  await check('notification preference update', async () => {
    await qa.updateNotificationPreference('community', false)
    const saved = await qa.getNotificationPreferences(); assert.equal(saved.categories.find(c => c.key === 'community').enabled,false)
    assert.deepEqual(saved.categories.find(c => c.key === 'critical'),{ key: 'critical', enabled: true, locked: true })
  })
  use('leader')
  const team = await api('/teams','POST',{ name: `QA FE Oct07 ${stamp}`, sportTypeId: 3 }); artifacts.teamId = team.id
  assert.ok(team.id)
  // Retain the new team as a clearly named QA fixture; do not delete existing records.
  cleanup.push(async () => { use('leader'); await qa.setTeamVisibility(team.id,'private') })
  await check('team public visibility', async () => { await qa.setTeamVisibility(team.id,'public'); assert.equal((await api(`/teams/${team.id}`)).visibility,'public') })
  use('user')
  await qa.requestToJoin(team.id,'Disposable QA cancel flow')
  let request = (await qa.getMyJoinRequests()).items.find(r => r.team.id === team.id && r.status === 'pending'); assert.ok(request)
  await check('own join request cancellation', async () => { await qa.cancelJoinRequest(request.id); assert.equal((await qa.getMyJoinRequests()).items.find(r => r.id === request.id).status,'cancelled') })
  await qa.requestToJoin(team.id,'Disposable QA reject flow')
  request = (await qa.getMyJoinRequests()).items.find(r => r.team.id === team.id && r.status === 'pending'); assert.ok(request)
  use('leader')
  await check('leader request rejection and reason', async () => { await qa.reviewJoinRequest(team.id,request.id,false,'Disposable QA rejection'); use('user'); const r=(await qa.getMyJoinRequests()).items.find(r => r.id === request.id); assert.equal(r.status,'rejected'); assert.equal(r.rejectReason,'Disposable QA rejection') })
  use('user'); await qa.requestToJoin(team.id,'Disposable QA approve flow')
  request = (await qa.getMyJoinRequests()).items.find(r => r.team.id === team.id && r.status === 'pending'); assert.ok(request)
  use('leader')
  await check('leader queue and approval', async () => { assert.ok((await qa.getTeamJoinRequests(team.id)).items.some(r => r.id === request.id)); await qa.reviewJoinRequest(team.id,request.id,true); use('user'); assert.equal((await qa.getMyJoinRequests()).items.find(r => r.id === request.id).status,'approved'); assert.ok((await api('/me/teams')).items.some(t => t.id === team.id)) })
  use('organizer')
  const now = Date.now(), day = ms => new Date(ms).toISOString().slice(0,10)
  const payload = { name: `QA FE BO ${stamp}`, sportTypeId: 3, bestOf: 3, bracketFormat: 'single_elimination', scopeType: 'faculty', organizingFacultyId: 2, registrationStart: new Date(now-3600000).toISOString(), registrationEnd: new Date(now+86400000).toISOString(), eventStartDate: day(now+2*86400000), eventEndDate: day(now+3*86400000), minTeams: 2, maxTeams: 4, venue: 'Disposable QA venue', genderRequirement: 'any', eligibilityRules: [] }
  await check('football creation rejects BO with field details', async () => {
    try { await api('/tournaments','POST',{...payload,sportTypeId:1,bestOf:3}); assert.fail('Accepted unsupported BO') }
    catch(e) { assert.equal(e.status,400); assert.equal(e.code,'BEST_OF_NOT_SUPPORTED'); assert.ok(e.fields?.bestOf) }
  })
  const tour = await api('/tournaments','POST',payload); artifacts.tournamentId = tour.id; assert.ok(tour.id)
  await check('new tournament pending approval', async () => assert.equal(tour.status,'pending_approval'))
  use('guest'); await check('guest pending tournament hidden', () => error(() => api(`/tournaments/${tour.id}`),404,'TOURNAMENT_NOT_FOUND'))
  use('uni'); await check('admin tournament approval', () => api(`/tournaments/${tour.id}/approve`,'POST'))
  use('guest'); await check('guest private tournament hidden', () => error(() => api(`/tournaments/${tour.id}`),404,'TOURNAMENT_NOT_FOUND'))
  use('organizer')
  for (const [role,userId] of [['refereeA',9051],['refereeB',9052]]) {
    const invitation = await api(`/tournaments/${tour.id}/referees`,'POST',{userId,isExternal:false})
    use(role)
    await check(`referee invitation acceptance: ${role}`, () => api(`/referee-invitations/${invitation.id}/accept`,'POST',{}))
    use('organizer')
  }
  await check('publish tournament', () => api(`/tournaments/${tour.id}/publish`,'POST'))
  cleanup.push(async () => { use('organizer'); const t=await api(`/tournaments/${tour.id}`); if(t.registrationOpen) await api(`/tournaments/${tour.id}/close-registration`,'POST'); if(t.status==='public') await api(`/tournaments/${tour.id}/unpublish`,'POST') })
  await check('open registration', async () => { await api(`/tournaments/${tour.id}/open-registration`,'POST'); assert.equal((await api(`/tournaments/${tour.id}`)).registrationOpen,true) })
  use('guest'); await check('guest public tournament access', async () => assert.equal((await api(`/tournaments/${tour.id}`)).status,'public'))
  if (!('bestOf' in await api(`/tournaments/${tour.id}`))) results.push({name:'tournament detail omits bestOf',result:'BLOCKED',owner:'BE',message:'POST persists BO but GET detail does not expose it; verify match DTO separately'})
  use('leader')
  const application = await api(`/tournaments/${tour.id}/applications`,'POST',{teamId: team.id,playerIds:[9101,9003]}); artifacts.applicationId=application.id
  await check('application appears in personal entries', async () => assert.ok((await api('/me/applications')).items.some(a => a.id === application.id)))
  use('organizer')
  await check('organizer approves tournament entry', () => api(`/applications/${application.id}/approve`,'POST'))
  await check('approved team appears in tournament', async () => assert.ok((await api(`/tournaments/${tour.id}/teams`)).items.some(t => (t.team?.id ?? t.id) === team.id)))
  await check('whole tournament BO update response', async () => { assert.equal((await api(`/tournaments/${tour.id}/format`,'PATCH',{bestOf:5})).bestOf,5) })
  const ann = await api(`/tournaments/${tour.id}/announcements`,'POST',{type:'venue_change',title:'QA FE venue',body:'Disposable QA announcement'}); artifacts.announcementId=ann.id
  await check('announcement type and edit', async () => { await api(`/announcements/${ann.id}`,'PATCH',{type:'general',title:'QA FE edited',body:'Disposable QA edited'}); const a=(await api(`/tournaments/${tour.id}/announcements`)).items.find(a=>a.id===ann.id); assert.equal(a.type,'general'); assert.equal(a.title,'QA FE edited') })
  await check('delete newly created announcement', async () => { await api(`/announcements/${ann.id}`,'DELETE'); assert.ok(!(await api(`/tournaments/${tour.id}/announcements`)).items.some(a=>a.id===ann.id)) })
  use('leader'); await check('withdraw newly approved entry', () => api(`/applications/${application.id}/withdraw`,'POST'))
  use('user')
  await check('upload private report evidence and review rejection', async () => {
    const p = await api('/uploads/presign','POST',{purpose:'report_evidence',contentType:'image/png'})
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/pkAAAAASUVORK5CYII=','base64')
    const put = await fetch(p.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:png}); assert.equal(put.status,200)
    await qa.reportUser(9101,'Disposable QA report - no real allegation',[p.objectKey])
    use('uni'); const r=(await qa.getUserReports(1)).items.find(r=>r.reason==='Disposable QA report - no real allegation' && r.status==='pending'); assert.ok(r); artifacts.reportId=r.id
    assert.equal((await fetch(r.evidence[0])).status,200)
    await qa.decideUserReport(r.id,false,{reason:'Disposable QA completed; no action against user'})
    assert.equal((await qa.getUserReports(1)).items.find(v=>v.id===r.id).status,'rejected')
  })
  for (const role of ['uni','root','faculty']) {
    use(role)
    await check(`audit pagination: ${role}`,async()=>{ if(role==='faculty') return error(()=>api('/admin/audit-logs?page=1&pageSize=20'),403,'INSUFFICIENT_ADMIN_SCOPE'); const r=await api('/admin/audit-logs?page=1&pageSize=20'); assert.equal(r.pagination.pageSize,20); assert.ok(Array.isArray(r.items)) })
  }
  use('user'); await check('logout endpoint', () => api('/auth/logout','POST'))
} catch (e) {
  results.push({ name: 'scenario stopped', result: 'FAIL', status:e.status, code:e.code, message:e.message }); console.log('STOP',e.code??e.message)
} finally {
  for (const [i,fn] of cleanup.entries()) await check(`restore/close test state ${i+1}`,fn)
  client.setAccessToken(null)
  await server.close()
  const report={timestamp:new Date().toISOString(),origin,mode:'real API via Vite proxy and SSR-loaded frontend client/qaFeatures; no browser',artifacts,results}
  await writeFile('QA-LIVE-2026-10-07-results.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({pass:results.filter(r=>r.result==='PASS').length,fail:results.filter(r=>r.result==='FAIL').length,blocked:results.filter(r=>r.result==='BLOCKED').length,artifacts}))
  if(results.some(r=>r.result==='FAIL')) process.exitCode=1
}
