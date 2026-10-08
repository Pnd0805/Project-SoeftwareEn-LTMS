const fs = require('node:fs'), path = require('node:path');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules'; require('node:module').Module._initPaths();
const kit = require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const origin = 'http://127.0.0.1:5183';
const phase = process.argv[2] || 'after';
const out = path.join(__dirname, phase); fs.mkdirSync(out, {recursive:true});
const records=[];
const cases=[
 ['home','/','mock','u-play'], ['schedule','/t/t-fb/schedule','mock','u-play'],
 ['bracket','/t/t-fb/bracket','mock','u-play'], ['team','/team/t-byt','mock','u-lead'],
 ['queue','/matches','fixture06',{}], ['result','/m/100/result','fixture06',{}],
 ['request','/request','fixture05',{}], ['organizer','/t/42/manage/referees','fixture05',{}],
 ['inbox','/inbox','fixture08b',{}], ['search','/search/Northside','fixture08b',{}],
 ['admin','/admin/requests','fixture07',{}],
];
(async()=>{const browser=await kit.chromium.launch({headless:true,executablePath:kit.executablePath});try{
for(const width of (['before','q10','q13'].includes(phase)?[1440,390]:[1280,1440,390,320])) for(const theme of ['dark','light']) for(const [name,url,fixture,mode] of cases.filter(c=>(phase!=='q10'||['home','schedule','bracket','team'].includes(c[0]))&&(phase!=='q13'||['bracket','organizer'].includes(c[0])))){
 const context=await browser.newContext({viewport:{width,height:width<500?844:width===1280?800:900},colorScheme:theme});
 await context.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/**',r=>r.abort());
 if(fixture!=='mock'){
  await page.route('**/src/api/client.ts',async r=>{const res=await r.fetch();const body=(await res.text()).replace(/export const USE_MOCK = .*?;/,'export const USE_MOCK = false;');await r.fulfill({response:res,body});});
  await kit[fixture](page,mode);
 }else{
  await page.goto(origin+'/login');await page.locator('h1').waitFor();
  await page.evaluate(async user=>{const s=await import('/src/shared/store.ts'),a=await import('/src/api/user.ts'),{numOf}=await import('/src/mocks/storeBridge.ts');s.login(user);a.setMockCurrentUser(numOf(user));},mode);
 }
 await page.goto(origin+url);await page.locator('main').waitFor();await page.waitForTimeout(650);await page.evaluate(()=>document.fonts.ready);
 const metrics=await page.evaluate(()=>{
  const rect=e=>e?{y:e.getBoundingClientRect().y,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}:null;
  return {overflow:document.documentElement.scrollWidth>innerWidth,main:rect(document.querySelector('main')),headings:[...document.querySelectorAll('main h1,main h2,main h3')].map(e=>({text:e.textContent,...rect(e)})),bracket:rect(document.querySelector('.brkt')),firstMatch:rect(document.querySelector('.brkt .mt,.tour-match-item,.brkt button,.brkt a')),firstCard:rect(document.querySelector('.tour-card,.tournament-card')),homePanels:[...document.querySelectorAll('.home-workspace .panel')].map(rect),currentRoute:document.querySelector('nav [aria-current]')?.textContent,searchLandmark:!!document.querySelector('[role=search]'),headers:[...document.querySelectorAll('th')].slice(0,9).map(e=>({text:e.textContent,fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})),text:document.querySelector('main').innerText.slice(0,1600)};
 });
 await page.screenshot({path:path.join(out,`${name}-${width}-${theme}.png`),fullPage:true});records.push({name,width,theme,url,errors,...metrics});await context.close();
}
}finally{await browser.close();fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(records,null,2));}console.log(`${phase}: ${records.length} captures; page errors ${records.reduce((n,r)=>n+r.errors.length,0)}; overflow ${records.filter(r=>r.overflow).length}`);})().catch(e=>{console.error(e);process.exitCode=1});
