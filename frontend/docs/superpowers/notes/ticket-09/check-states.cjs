// Supplemental states in the same initial visual batch; synthetic HTTP only.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.join(__dirname,'check-browser.cjs');const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);
m._compile(fs.readFileSync(filename,'utf8').split('\nasync function run() {')[0]+'\nmodule.exports={fixtures,capture,checks,errors,executablePath};',filename);
const {fixtures,capture,checks,errors,executablePath}=m.exports;
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath});try{
for(const [width,height] of [[1280,800],[1440,900],[390,844]])for(const theme of ['dark','light']){
 const c=await b.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});await c.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/v1/**',r=>r.abort());await p.goto('http://127.0.0.1:5175/home/all?preview=t-fb');await p.getByRole('dialog').waitFor();
 await capture(p,`preview-${width}-${theme}`,{dialog:true});await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});
 checks.push({name:`reduced-motion-${width}-${theme}`,durations:await p.locator('.btn').first().evaluate(e=>({animation:getComputedStyle(e).animationName,transition:getComputedStyle(e).transitionDuration}))});await c.close();
 const d=await b.newContext({viewport:{width,height},colorScheme:theme});await d.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);const q=await d.newPage();q.on('pageerror',e=>errors.push(e.message));await fixtures['04'](q,{});
 await q.route('**/api/v1/tournaments/42/comments*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{id:42,tournamentId:42,author:{id:8,fullName:'Northside Community Player'},content:'Long comment for review. '.repeat(12),createdAt:'2026-10-01T00:00:00Z',isMine:false}],mine:null,canComment:true,canModerate:false,pagination:{page:1,pageSize:20,totalItems:1,totalPages:1}})}));
 await q.goto('http://127.0.0.1:5176/t/42/community');await q.getByRole('button',{name:'Report',exact:true}).click();await q.getByRole('dialog').waitFor();await capture(q,`report-${width}-${theme}`,{dialog:true,quote:await q.locator('.modal .panel.quiet').evaluate(e=>({border:getComputedStyle(e).borderLeft,background:getComputedStyle(e).backgroundColor}))});await q.keyboard.press('Escape');await q.getByRole('dialog').waitFor({state:'hidden'});await d.close();
 const e=await b.newContext({viewport:{width,height},colorScheme:theme});await e.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);const r=await e.newPage();const mode={failure:'/teams'};await fixtures['08b'](r,mode);
 await r.goto('http://127.0.0.1:5176/search/Northside');await r.getByRole('button',{name:'Retry teams'}).waitFor();await capture(r,`search-partial-${width}-${theme}`,{partialSource:true});
 mode.failure='';mode.denied='/me/notifications';await r.goto('http://127.0.0.1:5176/inbox');await r.getByText('Unable to load inbox',{exact:true}).waitFor();await capture(r,`inbox-denied-${width}-${theme}`,{deniedContentHidden:await r.locator('.inbox-notifications .notif').count()===0});await e.close();
 console.log(`States ${width} ${theme}`);
}
}finally{await b.close();fs.writeFileSync(path.join(__dirname,'states.json'),JSON.stringify({checks,errors},null,2));}})().catch(e=>{console.error(e);process.exitCode=1});
