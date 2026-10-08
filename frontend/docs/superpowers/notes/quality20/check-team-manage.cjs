// Isolated HTTP/mock contexts only. No live backend or visible demo data changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.env.NODE_PATH='/private/tmp/ltms-ticket1-browser/node_modules';require('node:module').Module._initPaths();
const {chromium,executablePath}=require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const before=process.env.LTMS_QA_BEFORE==='true';
const out=path.join(__dirname,before?'q18-before':'q18-after');fs.mkdirSync(out,{recursive:true});
const origin='http://127.0.0.1:5183',records=[];
const longName='Northside Community Championship Football Team for Engineering and Sporting Academies';
async function stack(page,mock) {
  await page.route('**/api/v1/**',r=>r.abort());
  await page.route('**/src/api/client.ts',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/export const USE_MOCK = .*?;/,`export const USE_MOCK = ${mock};`)});});
}
async function fixture(page,mode) {
  const writes=[];
  await page.route('**/api/v1/**',async r=>{
    const request=r.request(),url=new URL(request.url()),apiPath=url.pathname.replace('/api/v1','');let status=200,data={items:[]};
    if(request.method()!=='GET'){writes.push({path:apiPath,method:request.method(),body:request.postData()});status=503;data={error:{code:'UNAVAILABLE',message:'Fixture mutation blocked'}};}
    else if(apiPath==='/me')data={id:7,fullName:'Captain Northside',userType:'student',roles:['player']};
    else if(apiPath==='/me/teams'){if(mode.roleDenied){status=403;data={error:{code:'DENIED',message:'Leader source denied'}};}else data={items:[{id:42,name:longName,sportTypeId:1,role:'leader'}]};}
    else if(apiPath==='/sport-types')data={items:[{id:1,name:'Football',defaultMode:'onsite',minMembers:2,maxMembers:12}]};
    else if(apiPath==='/teams/42')data={id:42,name:longName,sportTypeId:1,readinessStatus:'Ready',officialStatus:'Unofficial',visibility:'public',leader:{id:7,fullName:'Captain Northside'},memberCount:3,maxMembers:12,createdAt:'2026-10-01',logoUrl:null};
    else if(apiPath==='/teams/42/members')data={items:[{userId:7,fullName:'Captain Northside',joinedAt:'2026-10-01'},{userId:11,fullName:'Bob Member',joinedAt:'2026-10-01'},{userId:12,fullName:'Cara Member',joinedAt:'2026-10-01'}]};
    else if(apiPath==='/users/search')data={items:[{id:13,fullName:'Dena Player',avatarUrl:null}]};
    await r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });return writes;
}
async function shot(page,name) {
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(180);
  await page.evaluate(()=>{document.activeElement?.blur?.();scrollTo(0,0);});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
}
async function measureTabs(page,record,name) {
  record.panels=[];
  for(const tab of ['Members','Invites','Manage']){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    const panel=page.getByRole('tabpanel',{name:tab,exact:true});await panel.waitFor();
    assert.equal(await page.getByRole('tabpanel').count(),1);
    const dimensions=await panel.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top+scrollY,scrollHeight:e.scrollHeight}));
    const recordY=await page.locator('.team-record').count()?await page.locator('.team-record').evaluate(e=>e.getBoundingClientRect().top+scrollY):null;
    record.panels.push({tab,...dimensions,recordY});
    if(tab==='Manage'){
      record.manage=await panel.evaluate(e=>{const buttons=[...e.querySelectorAll('button')],first=buttons[0],last=buttons[buttons.length-1];return{firstActionFromTop:first.getBoundingClientRect().top-e.getBoundingClientRect().top,dangerFromTop:last.getBoundingClientRect().top-e.getBoundingClientRect().top,usedHeight:Math.max(...[...e.querySelector('.team-manage').children].map(child=>child.getBoundingClientRect().bottom))-e.getBoundingClientRect().top}});
      await shot(page,name+'-manage');
    }
  }
  if(record.width>=1280){assert(record.panels.every(p=>p.width===record.panels[0].width&&p.height===440&&p.top===record.panels[0].top));if(record.panels[0].recordY!==null)assert(record.panels.every(p=>p.recordY===record.panels[0].recordY));}
  // Existing automatic tabs and native Tab exclude hidden panel controls.
  await page.getByRole('tab',{name:'Members',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:'Invites',exact:true}).getAttribute('aria-selected'),'true');
  const canInvite=await page.getByLabel('Search users to invite').count();
  if(canInvite)await page.getByLabel('Search users to invite').fill('Dena');
  await page.getByRole('tab',{name:'Invites',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');assert(await page.getByRole('tabpanel',{name:'Manage',exact:true}).evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Tab');assert(await page.getByRole('button',{name:/^Rename$|^Edit name & code$/}).evaluate(e=>e===document.activeElement));
  await page.getByRole('tab',{name:'Invites',exact:true}).click();
  if(canInvite)assert.equal(await page.getByLabel('Search users to invite').inputValue(),'Dena');
  record.keyboardAndDraft={keyboard:true,draft:canInvite?'retained':'unavailable: roster locked'};
}
(async()=>{const browser=await chromium.launch({headless:true,executablePath});try{
  for(const[width,height,theme]of[[1280,800,'dark'],[1280,800,'light'],[1440,900,'dark'],[1440,900,'light'],[390,844,'dark'],[390,844,'light']]){
    const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);
    const page=await context.newPage(),mode={},errors=[],record={stack:'real-contract',width,height,theme,errors};page.on('pageerror',e=>errors.push(e.message));
    await stack(page,false);const writes=await fixture(page,mode);await page.goto(origin+'/team/42');await page.getByRole('tab',{name:'Manage',exact:true}).waitFor();
    await measureTabs(page,record,`leader-${width}-${theme}`);
    await page.getByRole('tab',{name:'Manage',exact:true}).click();
    if(!before){
      await page.getByRole('region',{name:'Team settings',exact:true}).waitFor();
      await page.getByRole('button',{name:'Disband',exact:true}).click();const dialog=page.getByRole('dialog',{name:`Disband ${longName}?`,exact:true});await dialog.waitFor();
      assert.match(await dialog.textContent(),/Every member loses the squad/);assert.equal(writes.length,0);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    }
    await page.getByRole('button',{name:'Rename',exact:true}).click();await page.getByLabel('Name — unique within the sport').fill('Retained private rename draft');
    mode.roleDenied=true;
    await page.evaluate(async()=>{const source=await(await fetch('/src/main.tsx')).text(),url=source.match(/from "([^"]*@tanstack_react-query[^"]*)"/)[1];const{focusManager}=await import(url);focusManager.setFocused(false);focusManager.setFocused(true)});
    await page.getByRole('tablist').waitFor({state:'hidden'});await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(await page.getByRole('button',{name:'Rename',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Profile for Bob Member',exact:true}).count(),1);
    record.roleLossHidesPrivateWork=true;assert.equal(writes.length,0);assert.deepEqual(errors,[]);records.push(record);await context.close();
  }
  // TeamRecord is supplied only by the established mock stack.
  for(const[width,height,theme]of[[1280,800,'dark'],[1440,900,'light'],[390,844,'light']]){
    const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);
    const page=await context.newPage(),errors=[],record={stack:'mock-record',width,height,theme,errors};page.on('pageerror',e=>errors.push(e.message));await stack(page,true);
    await page.goto(origin+'/login');await page.locator('h1').waitFor();await page.evaluate(async()=>{const s=await import('/src/shared/store.ts'),a=await import('/src/api/user.ts'),{numOf}=await import('/src/mocks/storeBridge.ts');s.login('u-lead');a.setMockCurrentUser(numOf('u-lead'));});
    await page.goto(origin+'/team/t-byt');await page.getByRole('tab',{name:'Manage',exact:true}).waitFor();await measureTabs(page,record,`mock-record-${width}-${theme}`);
    assert.deepEqual(errors,[]);records.push(record);await context.close();
  }
}finally{await browser.close();fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(records,null,2));}
console.log(JSON.stringify(records,null,2));})().catch(e=>{console.error(e);process.exitCode=1});
