// Opt-in local QA for Round 2/3. Writes only named disposable fixtures; credentials stay in memory.
import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const origin = process.env.LTMS_QA_ORIGIN ?? 'http://127.0.0.1:5193'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin) || !process.env.LTMS_QA_PASSWORD || !process.argv.includes('--write')) throw new Error('Requires local origin, fixture password and --write')
const nativeFetch = globalThis.fetch
globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options)
const storage = new Map()
globalThis.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) }
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const client = await server.ssrLoadModule('/src/api/client.ts')
const teams = await server.ssrLoadModule('/src/api/team.ts')
const users = await server.ssrLoadModule('/src/api/user.ts')
const tournaments = await server.ssrLoadModule('/src/api/tournament.ts')
const results = [], artifacts = {}, cleanup = []
const api = (path, method = 'GET', body) => client.apiFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const tokens = {}
const use = role => client.setAccessToken(tokens[role] ?? null)
const check = async (name, fn) => { try { await fn(); results.push({name,result:'PASS'}) } catch(e) { results.push({name,result:'FAIL',status:e.status,code:e.code,message:e.message}) } }
const refusal = async (fn, status, code) => assert.rejects(fn, e => e.status === status && e.code === code)
try {
  assert.equal(client.USE_MOCK,false)
  for (const [role,email] of Object.entries({user:'mana@ku.th',leader:'playerA1@ku.th',organizer:'somying@ku.th',uni:'somchai@ku.th',refereeA:'referee3@ku.th',refereeB:'referee4@ku.th'})) tokens[role]=(await api('/auth/login','POST',{email,password:process.env.LTMS_QA_PASSWORD})).accessToken
  use('user')
  const before = await api('/me')
  cleanup.push(async()=>{use('user'); await api('/me','PATCH',{contactInfo:before.contactInfo,address:before.address,showProfileStats:before.showProfileStats})})
  await check('PATCH /me null clear and readback',async()=>{await api('/me','PATCH',{contactInfo:null,address:null}); const me=await api('/me'); assert.equal(me.contactInfo,null);assert.equal(me.address,null)})
  await check('profile new length limits',async()=>{await assert.rejects(()=>api('/me','PATCH',{contactInfo:'x'.repeat(256)}),e=>e.status===400);await assert.rejects(()=>api('/me','PATCH',{address:'x'.repeat(2001)}),e=>e.status===400)})
  await check('safe search returns faculty/year without private contact fields',async()=>{const data=await users.searchUsers('ผู้เล่น');assert.ok(data.items.length); for(const row of data.items){assert.ok('facultyName' in row && 'year' in row);assert.ok(!('email' in row) && !('contactInfo' in row))}})
  use('leader')
  const team = await api('/teams','POST',{name:`QA R23 ${Date.now()}`,sportTypeId:3}); artifacts.teamId=team.id
  cleanup.push(async()=>{use('leader'); const t=await api(`/teams/${team.id}`); assert.ok(t.name.startsWith('QA R23 '));await api(`/teams/${team.id}`,'DELETE')})
  await check('leader self-leave is refused',()=>refusal(()=>teams.leaveTeam(team.id),409,'LEADER_CANNOT_LEAVE'))
  const invite=await api(`/teams/${team.id}/invitations`,'POST',{invitedUserId:9003})
  use('user');await api(`/invitations/${invite.id}/accept`,'POST')
  await check('member self-leave returns 204 and removes own team entry',async()=>{await teams.leaveTeam(team.id);assert.ok(!(await api('/me/teams')).items.some(t=>t.id===team.id))})
  await check('non-member self-leave is 404',async()=>{await assert.rejects(()=>teams.leaveTeam(team.id),e=>e.status===404)})
  use('leader');const back=await api(`/teams/${team.id}/invitations`,'POST',{invitedUserId:9003})
  use('user');await api(`/invitations/${back.id}/accept`,'POST')
  use('organizer'); const now=Date.now(), day=d=>new Date(d).toISOString().slice(0,10)
  const tour=await api('/tournaments','POST',{name:`QA R23 no played match ${now}`,sportTypeId:3,bestOf:5,bracketFormat:'single_elimination',scopeType:'faculty',organizingFacultyId:2,registrationStart:new Date(now-3600000).toISOString(),registrationEnd:new Date(now+86400000).toISOString(),eventStartDate:day(now+2*86400000),eventEndDate:day(now+3*86400000),minTeams:2,maxTeams:4,venue:'Disposable QA Round 2/3',genderRequirement:'any',eligibilityRules:[]})
  artifacts.tournamentId=tour.id
  cleanup.push(async()=>{use('organizer');const t=await api(`/tournaments/${tour.id}`);if(t.registrationOpen)await api(`/tournaments/${tour.id}/close-registration`,'POST');if(t.status==='public')await api(`/tournaments/${tour.id}/unpublish`,'POST')})
  use('uni'); await api(`/tournaments/${tour.id}/approve`,'POST')
  use('organizer')
  await check('detail exposes stored tournament bestOf',async()=>assert.equal((await tournaments.getTournament(tour.id)).bestOf,5))
  await check('immutable and amendment fields reject silent tournament PATCH',()=>refusal(()=>api(`/tournaments/${tour.id}`,'PATCH',{maxTeams:8}),409,'USE_AMENDMENT_REQUEST'))
  for(const [role,userId] of [['refereeA',9051],['refereeB',9052]]) {use('organizer');const ref=await tournaments.inviteReferee(tour.id,{userId});use(role);await api(`/referee-invitations/${ref.id}/accept`,'POST')}
  use('organizer');await api(`/tournaments/${tour.id}/publish`,'POST');await api(`/tournaments/${tour.id}/open-registration`,'POST')
  use('leader'); const application=await api(`/tournaments/${tour.id}/applications`,'POST',{teamId:team.id,playerIds:[9101,9003]});artifacts.applicationId=application.id
  use('organizer');await api(`/applications/${application.id}/approve`,'POST')
  use('user'); await check('approved tournament membership lock is preserved on self-leave',()=>refusal(()=>teams.leaveTeam(team.id),409,'MEMBER_LOCKED_IN_TOURNAMENT'))
  use('organizer'); await check('tournament has no matches before withdrawal',async()=>{const ms=await api(`/tournaments/${tour.id}/matches`);artifacts.matchesBeforeWithdrawal=ms.items;assert.equal(ms.items.length,0)})
  use('leader');await api(`/applications/${application.id}/withdraw`,'POST')
  await check('same team and players can reapply before any match is played',async()=>{const retry=await api(`/tournaments/${tour.id}/applications`,'POST',{teamId:team.id,playerIds:[9101,9003]});artifacts.retryApplicationId=retry.id;await api(`/applications/${retry.id}/cancel`,'POST')})
  use('user');await check('self-leave works after withdrawal unlock',()=>teams.leaveTeam(team.id))
} catch(e) {results.push({name:'QA setup/continuation',result:'FAIL',status:e.status,code:e.code,message:e.message})}
finally {
  for(const task of cleanup.reverse()) await check('restore/cleanup disposable QA state',task)
  await server.close()
  await writeFile('QA-ROUND23-2026-10-07-results.json',JSON.stringify({timestamp:new Date().toISOString(),backendRef:'7aae61f',origin,mode:'real backend with SSR-loaded FE adapters',artifacts,results},null,2)+'\n')
}
console.log(JSON.stringify({artifacts,results}))
if(results.some(r=>r.result==='FAIL'))process.exitCode=1
