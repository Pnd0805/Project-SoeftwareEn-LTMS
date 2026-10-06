// Continue only the newly created Oct07 QA tournament recorded by live-qa.
import { createServer } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
if (!process.env.LTMS_QA_PASSWORD || !process.argv.includes('--write')) throw new Error('Requires fixture password and --write')
const origin = 'http://127.0.0.1:5193', originalFetch = fetch, requests = []
globalThis.fetch = (url, options) => { const u=new URL(url,origin); requests.push(u.pathname); return originalFetch(u,options) }
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
const client=await server.ssrLoadModule('/src/api/client.ts')
const match=await server.ssrLoadModule('/src/api/match.ts')
const tournaments=await server.ssrLoadModule('/src/api/tournament.ts')
const admin=await server.ssrLoadModule('/src/api/admin.ts')
const api=(path,method='GET',body)=>client.apiFetch(path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})})
const initial=JSON.parse(await readFile('QA-LIVE-2026-10-07-results.json','utf8'))
const sourceTourId=initial.artifacts.tournamentId, teamId=9008, tokens={}, results=[], applications=[]
let tourId
const use=role=>client.setAccessToken(tokens[role]??null)
const check=async(name,fn)=>{try{await fn();results.push({name,result:'PASS'});console.log('PASS',name)}catch(e){results.push({name,result:'FAIL',status:e.status,code:e.code,message:e.message});console.log('FAIL',name,e.code??e.message)}}
let matchId
try {
  for(const [role,email] of Object.entries({organizer:'somying@ku.th',leader:'playerA1@ku.th',leaderB:'playerB1@ku.th',uni:'somchai@ku.th',referee:'referee3@ku.th',refereeB:'referee4@ku.th',external:'referee.ext@outside.org'})) {
    tokens[role]=(await api('/auth/login','POST',{email,password:process.env.LTMS_QA_PASSWORD})).accessToken
  }
  use('organizer'); const source=await api(`/tournaments/${sourceTourId}`); assert.match(source.name,/^QA FE BO /)
  const payload=Object.fromEntries(['sportTypeId','bracketFormat','scopeType','organizingFacultyId','organizingDepartmentId','registrationStart','registrationEnd','eventStartDate','eventEndDate','maxTeams','minTeams','venue','genderRequirement'].map(k=>[k,source[k]]))
  const created=await api('/tournaments','POST',{...payload,name:`QA FE BO Match ${new Date().toISOString()}`,bestOf:5,eligibilityRules:[]}); tourId=created.id
  use('uni'); await api(`/tournaments/${tourId}/approve`,'POST')
  for(const [role,userId] of [['referee',9051],['refereeB',9052]]) {
    use('organizer'); const invitation=await api(`/tournaments/${tourId}/referees`,'POST',{userId,isExternal:false})
    use(role); await api(`/referee-invitations/${invitation.id}/accept`,'POST',{})
  }
  use('organizer'); await api(`/tournaments/${tourId}/publish`,'POST'); await api(`/tournaments/${tourId}/open-registration`,'POST')
  for(const [role,team,players] of [['leader',teamId,[9101,9102]],['leaderB',9009,[9103,9104]]]) {
    use(role); const a=await api(`/tournaments/${tourId}/applications`,'POST',{teamId:team,playerIds:players}); applications.push({role,id:a.id})
    use('organizer'); await api(`/applications/${a.id}/approve`,'POST')
  }
  await check('frontend draw adapter against live API',async()=>{const response=await tournaments.drawTournament(tourId);assert.ok(response.bracket)})
  const matches=await match.getBackendTournamentMatches(tourId); matchId=matches.items[0].id; assert.ok(matchId)
  await check('drawn match inherits persisted tournament BO5',async()=>assert.equal((await match.getBackendMatch(matchId)).bestOf,5))
  await check('frontend whole-tournament format updates actual match',async()=>{await tournaments.setTournamentFormat(tourId,3);assert.equal((await match.getBackendMatch(matchId)).bestOf,3)})
  await check('single match format override and null clearing',async()=>{await api(`/matches/${matchId}/format`,'PATCH',{bestOf:7});assert.equal((await match.getBackendMatch(matchId)).bestOf,7);await api(`/matches/${matchId}/format`,'PATCH',{bestOf:null});assert.equal((await match.getBackendMatch(matchId)).bestOf,null)})
  use('guest'); requests.length=0
  await check('real guest getMatch skips personal API reads',async()=>{assert.equal((await match.getMatch(matchId)).id,matchId);assert.ok(!requests.includes('/api/v1/me'));assert.ok(!requests.includes('/api/v1/me/teams'))})
  use('organizer'); await api(`/tournaments/${tourId}/close-registration`,'POST'); await api(`/tournaments/${tourId}/unpublish`,'POST')
  use('guest'); requests.length=0
  await check('private match 404 stops frontend enrichment',async()=>{await assert.rejects(()=>match.getMatch(matchId),e=>e.status===404&&e.code==='MATCH_NOT_FOUND');assert.deepEqual(requests,[`/api/v1/matches/${matchId}`])})
  for(const role of ['organizer','uni','referee']) {
    use(role);await check(`private tournament legitimate access: ${role}`,async()=>assert.equal((await api(`/tournaments/${tourId}`)).id,tourId))
  }
  use('uni'); await check('frontend audit actor mapper and page2',async()=>{const r=await admin.getAuditLogs({page:2});assert.equal(r.pagination.page,2);assert.ok(r.items.length);assert.equal(typeof r.items[0].user.fullName,'string')})
  use('external'); await check('external identity read contract',async()=>{const r=await api('/me/referee-identity');assert.equal(typeof r.docsRequired,'boolean');assert.ok('status' in r)})
} catch(e) {results.push({name:'match scenario stopped',result:'FAIL',status:e.status,code:e.code,message:e.message});console.log('STOP',e.code??e.message)}
finally {
  for(const a of applications){use(a.role);await check(`withdraw only new test entry ${a.id}`,()=>api(`/applications/${a.id}/withdraw`,'POST'))}
  use('organizer'); if(tourId) await check('restore tournament private and registration closed',async()=>{const t=await api(`/tournaments/${tourId}`);if(t.registrationOpen)await api(`/tournaments/${tourId}/close-registration`,'POST');if(t.status==='public')await api(`/tournaments/${tourId}/unpublish`,'POST')})
  await server.close()
  await writeFile('QA-LIVE-MATCH-2026-10-07-results.json',JSON.stringify({timestamp:new Date().toISOString(),origin,mode:'SSR-loaded frontend adapters with real API; no browser',artifacts:{tourId,teamId,matchId,applications},results},null,2)+'\n')
  console.log(JSON.stringify({pass:results.filter(r=>r.result==='PASS').length,fail:results.filter(r=>r.result==='FAIL').length,matchId}))
  if(results.some(r=>r.result==='FAIL'))process.exitCode=1
}
