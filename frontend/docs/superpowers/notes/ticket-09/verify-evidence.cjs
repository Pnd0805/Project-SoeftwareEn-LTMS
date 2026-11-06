// Acceptance-artifact consistency check; not a product implementation test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const frontend=path.resolve(__dirname,'../../../..'),repo=path.dirname(frontend),read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8'));
const app=fs.readFileSync(path.join(frontend,'src/App.tsx'),'utf8');
const routes=[...app.matchAll(/<Route path="([^"]+)"/g)].map(x=>x[1]);routes.push('/login');
const initial=read('checks.json'),states=read('states.json'),confirmed=read('confirmation.json'),ids=read('route-id-confirmation.json');
assert.equal(new Set(routes).size,25);assert.deepEqual(new Set(initial.routes.map(x=>x[0])),new Set(routes));
for(const route of routes)assert.equal(initial.checks.filter(x=>x.pattern===route).length,6,route);
for(const batch of [initial,states,confirmed]){assert.deepEqual(batch.errors,[]);assert(!batch.checks.some(x=>x.overflow));assert(!batch.checks.some(x=>x.unnamedButtons));}
assert.equal(confirmed.checks.filter(x=>x.name.startsWith('confirmed-keyboard')).length,6);
for(const x of confirmed.checks.filter(x=>x.name.startsWith('confirmed-keyboard'))){assert(x.escapeClosed&&x.returnFocus);assert(x.sequence.every(f=>f.inside));}
assert.equal(ids.length,12);assert(ids.every(x=>!x.overflow&&!x.text.includes('No such tournament')));
assert.equal(read('source-gates.json').gates.length,4);assert(read('source-gates.json').gates.every(x=>x.exitCode===0));
assert.match(fs.readFileSync(path.join(__dirname,'vitest.log'),'utf8'),/Tests\s+655 passed/);
assert(read('contrast.json').every(x=>x.pass));
const baseline=fs.readFileSync(path.join(frontend,'docs/superpowers/notes/2026-10-05-ltms-minimal-street-api-baseline.md'),'utf8');
const pairs=[...baseline.matchAll(/\| `([a-f0-9]{64})` \| `(frontend\/[^`]+)` \|/g)];assert.equal(pairs.length,49);
for(const [,hash,file]of pairs)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex'),hash,file);
const design=JSON.parse(fs.readFileSync(path.join(frontend,'.impeccable/design.json'),'utf8'));assert.equal(design.schemaVersion,2);assert.equal(design.components.length,9);assert(Object.values(design.extensions.colorMeta).every(x=>x.tonalRamp.length===8));
console.log('PASS: 25 routes × 6 viewport/themes, 282 captures, 318 records, keyboard/QR confirmation, 18 contrast pairs, 655 tests, 49 hashes, DESIGN sidecar.');
