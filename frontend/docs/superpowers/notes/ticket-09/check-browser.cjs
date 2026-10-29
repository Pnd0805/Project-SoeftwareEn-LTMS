// Desktop acceptance: synthetic browser data only; no live backend.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const out = process.env.LTMS_QA_OUT || __dirname, checks = [], errors = []; fs.mkdirSync(out,{recursive:true});
const executablePath = '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
function helper(ticket, marker) {
  const filename = path.resolve(__dirname, `../ticket-${ticket}/check-browser.cjs`);
  const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(fs.readFileSync(filename, 'utf8').split(marker)[0] + '\nmodule.exports={fixture};', filename);
  return m.exports.fixture;
}
const fixtures = {
  '04': helper('04', '\n(async()=>'), '05': require('../ticket-05/check-browser.cjs').fixture,
  '06': require('../ticket-06/check-browser.cjs').fixture, '07': require('../ticket-07/check-browser.cjs').fixture,
  '08a': helper('08a', 'async function run()'), '08b': helper('08b', 'async function run()'),
};
const routes = [
  ['/', '/', 'u-lead', '01'], ['/home/:tab', '/home/all', 'u-play', '02'],
  ['/t/:id', '/t/t-fb', 'u-play', '04'], ['/t/:id/:tab', '/t/t-fb/schedule', 'u-play', '04'],
  ['/t/:id/:tab/:sub', '/t/t-fb/manage/registrations', 'u-org', '05'],
  ['/m/:id', '/m/m-124', 'u-ref', '06'], ['/m/:id/fixture', '/m/m-124/fixture', 'u-play', '06'], ['/m/:id/:tab', '/m/m-124/stats', 'u-ref', '06'],
  ['/checkin/:id', '/checkin/m-124', 'u-ref', '06'], ['/mvp/:id', '/mvp/m-124', 'u-play', '06'],
  ['/team/:id', '/team/t-byt', 'u-lead', '03'], ['/player/:id', '/player/u-play', 'u-play', '03'], ['/watch/:id', '/watch/m-124', 'u-play', '06'],
  ['/search', '/search', 'u-play', '08B'], ['/search/:q', '/search/Football', 'u-play', '08B'],
  ['/register', '/register', null, '08A'], ['/login', '/login', null, '08A'],
  ['/teams', '/teams', 'u-lead', '03'], ['/matches', '/matches', 'u-ref', '06'], ['/inbox', '/inbox', 'u-play', '08B'],
  ['/me', '/me', 'u-play', '08A'], ['/request', '/request', 'u-play', '05'],
  ['/admin', '/admin', 'u-admin', '07'], ['/admin/:tab', '/admin/users', 'u-admin', '07'], ['*', '/unknown-route', 'u-play', '01'],
];
async function capture(page, name, detail = {}) {
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight, theme: document.documentElement.dataset.theme,
    overflow: document.documentElement.scrollWidth > innerWidth,
    h1: [...document.querySelectorAll('h1')].map(e => e.textContent.trim()),
    mainText: (document.querySelector('main') || document.body).innerText.slice(0, 350),
    unnamedButtons: [...document.querySelectorAll('main button')].filter(e => !e.textContent.trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.title).length,
    tokens: Object.fromEntries(['void','panel','panel-3','bone','bone-dim','bone-faint','teal','accent-ink','red-text','amber','qr-bg','qr-ink'].map(k => [k, getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim()])),
  }));
  await page.screenshot({path: path.join(out, name+'.png'), fullPage: !detail.dialog});
  checks.push({name, url: page.url(), ...metrics, ...detail});
}
async function run() {
  const browser = await chromium.launch({headless:true, executablePath});
  try {
    for (const [width,height] of [[1280,800],[1440,900],[390,844]]) for (const theme of ['dark','light']) {
      const context = await browser.newContext({viewport:{width,height},colorScheme:theme});
      await context.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);
      const page=await context.newPage(); page.on('pageerror',e=>errors.push({suite:'mock',width,theme,error:e.message}));
      await page.route('**/api/v1/**',r=>r.abort());
      await page.goto('http://127.0.0.1:5175/login'); await page.locator('h1').waitFor();
      for (const [pattern,url,user,ticket] of routes) {
        await page.evaluate(async user=>{const s=await import('/src/shared/store.ts'); const a=await import('/src/api/user.ts'); const {numOf}=await import('/src/mocks/storeBridge.ts'); user?s.login(user):s.signout();a.setMockCurrentUser(user?numOf(user):null);},user);
        await page.goto('http://127.0.0.1:5175'+url); await page.locator('main,h1').first().waitFor();
        await page.waitForTimeout(450);
        await capture(page,`mock-${routes.findIndex(x=>x[0]===pattern)}-${width}-${theme}`,{pattern,ticket,user});
      }
      // Guest and denied route handling plus keyboard entry to the content.
      await page.evaluate(async()=>{const s=await import('/src/shared/store.ts');s.continueAsGuest();const a=await import('/src/api/user.ts');a.setMockCurrentUser(null);});
      await page.goto('http://127.0.0.1:5175/'); await capture(page,`guest-home-${width}-${theme}`,{audience:'guest'});
      await page.keyboard.press('Tab'); const focus=await page.evaluate(()=>({text:document.activeElement.textContent.trim(),outline:getComputedStyle(document.activeElement).outlineStyle}));
      checks.push({name:`keyboard-entry-${width}-${theme}`,focus});
      await page.goto('http://127.0.0.1:5175/admin'); await capture(page,`guest-admin-${width}-${theme}`,{audience:'guest',deniedRedirect:page.url().endsWith('/login')});
      await context.close();
      for (const [ticket,cases,mode] of [
        ['04',[['bracket','/t/42/bracket'],['schedule','/t/42/schedule']],{}],
        ['05',[['organizer','/t/42/manage/registrations'],['request','/request']],{}],
        ['06',[['stats','/m/100/stats'],['checkin','/checkin/100'],['mvp','/mvp/100']],{}],
        ['07',[['admin','/admin/requests'],['admin-audit','/admin/audit']],{}],
        ['08a',[['profile','/me'],['register','/register']],{signedIn:true}],
        ['08b',[['search','/search/Northside'],['inbox','/inbox']],{}],
      ]) {
        const c=await browser.newContext({viewport:{width,height},colorScheme:theme});
        await c.addInitScript(t=>localStorage.setItem('ltms-theme',t),theme);
        const p=await c.newPage();p.on('pageerror',e=>errors.push({suite:ticket,width,theme,error:e.message}));
        await fixtures[ticket](p,mode);
        for(const [id,url] of cases){await p.goto('http://127.0.0.1:5176'+url);await p.locator('h1,main').first().waitFor();await p.waitForTimeout(650);await capture(p,`real-${id}-${width}-${theme}`,{ticket,synthetic:true});
          if(id==='admin'){
            const trigger=p.getByRole('button',{name:'Decline',exact:true}).first();await trigger.click();await p.getByRole('dialog').waitFor();
            await p.getByLabel(/Reason/).fill('Acceptance fixture draft');
            let contained=true;for(let i=0;i<12;i++){await p.keyboard.press('Tab');contained=contained&&await p.evaluate(()=>!!document.activeElement.closest('[role="dialog"]'));}
            await capture(p,`real-modal-${width}-${theme}`,{dialog:true,focusContained:contained});
            await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});
            checks.push({name:`modal-keyboard-${width}-${theme}`,focusContained:contained,escapeClosed:true,returnFocus:await trigger.evaluate(e=>e===document.activeElement)});
          }
        }
        await c.close();
      }
      console.log(`Captured ${width} ${theme}`);
    }
  } finally {await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({routes,checks,errors},null,2));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
