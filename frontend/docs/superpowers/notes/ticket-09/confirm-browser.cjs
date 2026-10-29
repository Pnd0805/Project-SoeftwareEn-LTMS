// Supplemental states in the same initial visual batch; synthetic HTTP only.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.join(__dirname,'check-browser.cjs');const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);
m._compile(fs.readFileSync(filename,'utf8').split('\nasync function run() {')[0]+'\nmodule.exports={fixtures,capture,checks,errors,executablePath};',filename);
const {fixtures,capture,checks,errors,executablePath}=m.exports;
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath});try{
for(const [width,height] of [[1280,800],[1440,900],[390,844]])for(const theme of ['dark','light']){
 const c=await b.newContext({viewport:{width,height},colorScheme:theme});await c.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await fixtures['04'](p,{});
 await p.route('**/api/v1/tournaments/42/comments*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{id:42,tournamentId:42,author:{id:8,fullName:'Northside Community Player'},content:'Long comment for review. '.repeat(12),createdAt:'2026-10-01T00:00:00Z',isMine:false}],mine:null,canComment:true,canModerate:false,pagination:{page:1,pageSize:20,totalItems:1,totalPages:1}})}));
 await p.goto('http://127.0.0.1:5176/t/42/community');await p.getByRole('button',{name:'Report',exact:true}).click();await p.getByRole('dialog').waitFor();
 const quote=await p.locator('.modal .panel.quiet').evaluate(e=>({border:getComputedStyle(e).borderLeft,amber:getComputedStyle(e).getPropertyValue('--amber').trim()}));assert(quote.border.startsWith('1px solid'));
 const option=await p.locator('.modal input[type=radio]:checked').evaluate(e=>({radius:getComputedStyle(e.parentElement).borderRadius,background:getComputedStyle(e.parentElement).backgroundColor}));assert.equal(option.radius,'2px');
 await capture(p,`confirm-report-${width}-${theme}`,{dialog:true,quote,option});await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});await c.close();
 const d=await b.newContext({viewport:{width,height},colorScheme:theme});await d.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);const q=await d.newPage();await fixtures['07'](q,{});await q.goto('http://127.0.0.1:5176/admin/requests');const trigger=q.getByRole('button',{name:'Decline',exact:true}).first();await trigger.click();await q.getByRole('dialog').waitFor();await q.getByLabel(/Reason/).fill('Acceptance fixture draft');
 const sequence=[];for(let i=0;i<12;i++){await q.keyboard.press('Tab');await q.waitForTimeout(60);const focus=await q.evaluate(()=>({inside:!!document.activeElement.closest('[role=dialog]'),tag:document.activeElement.tagName,text:document.activeElement.textContent.slice(0,40)}));assert(focus.inside);sequence.push(focus);}
 await q.keyboard.press('Escape');await q.getByRole('dialog').waitFor({state:'hidden'});assert(await trigger.evaluate(e=>e===document.activeElement));
 await q.goto('http://127.0.0.1:5176/');await q.locator('main').waitFor();await q.waitForTimeout(400);await q.keyboard.press('Tab');await q.waitForTimeout(60);const skip=await q.evaluate(()=>({text:document.activeElement.textContent.trim(),outline:getComputedStyle(document.activeElement).outlineStyle}));assert.equal(skip.text,'Skip to the main content');assert.equal(skip.outline,'solid');await q.keyboard.press('Enter');await q.waitForTimeout(60);assert(await q.locator('main').evaluate(e=>e===document.activeElement));
 checks.push({name:`confirmed-keyboard-${width}-${theme}`,sequence,escapeClosed:true,returnFocus:true,skip});await d.close();
 const e=await b.newContext({viewport:{width,height},colorScheme:theme});await e.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);const r=await e.newPage();await fixtures['06'](r,{status:'checkin_open'});await r.goto('http://127.0.0.1:5176/checkin/100');await r.locator('.checkin-qr-content svg').waitFor();const qr=await r.locator('.checkin-qr-content svg').evaluate(e=>[...e.querySelectorAll('path')].map(p=>getComputedStyle(p).fill));assert(qr.includes('rgb(229, 220, 200)')&&qr.includes('rgb(10, 8, 16)'));await capture(r,`confirmed-qr-${width}-${theme}`,{qr});await e.close();
 console.log(`Confirmed ${width} ${theme}`);
}
assert.equal(errors.length,0);assert(checks.filter(x=>x.overflow).length===0);
}finally{await b.close();fs.writeFileSync(path.join(__dirname,'confirmation.json'),JSON.stringify({checks,errors},null,2));}})().catch(e=>{console.error(e);process.exitCode=1});
