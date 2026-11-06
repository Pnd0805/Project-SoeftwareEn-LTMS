// Run existing isolated fixture checks against the merged frontend.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');

const mode = process.argv[2];
const names = {
  q11: 'check-q11.cjs',
  q12: 'check-q12.cjs',
  q22: 'check-q22.cjs',
  'mobile-shell': 'check-mobile-shell.cjs',
  'mobile-interactions': 'check-mobile-shell.cjs',
};
assert(names[mode], 'Choose q11, q12, q22, mobile-shell or mobile-interactions');
const origin = process.env.QUALITY20_ORIGIN || 'http://127.0.0.1:5185';
const output = path.join(__dirname, mode);
fs.mkdirSync(output, { recursive: true });
const filename = path.resolve(__dirname, '../../superpowers/notes/quality20', names[mode]);
let source = fs.readFileSync(filename, 'utf8');
source = source.replaceAll('http://127.0.0.1:5193', origin).replaceAll('http://127.0.0.1:5183', origin);
if (mode.startsWith('mobile-')) {
  const marker = "path.join(__dirname, before ? 'q20-before' : 'q20-after')";
  assert(source.includes(marker), 'Mobile output declaration changed');
  source = source.replace(marker, JSON.stringify(output));
  process.argv[2] = mode === 'mobile-interactions' ? 'interactions' : 'after';
} else {
  const marker = "path.resolve('docs/superpowers/notes/quality20')";
  assert(source.includes(marker), 'Fixture output declaration changed');
  source = source.replace(marker, JSON.stringify(output));
}
if (mode === 'q22') {
  const dist = process.env.QUALITY20_MOCK_DIST;
  assert(dist && fs.existsSync(path.join(dist, 'index.html')), 'QUALITY20_MOCK_DIST must point to a mock production build');
  source = source.replace("path.resolve('dist')", JSON.stringify(path.resolve(dist)));
}
const runner = new Module(filename, module);
runner.filename = filename;
runner.paths = Module._nodeModulePaths(path.dirname(filename));
process.on('exit', exitCode => {
  fs.writeFileSync(path.join(output, 'run-result.json'), JSON.stringify({ mode, origin, exitCode }, null, 2) + '\n');
});
runner._compile(source, filename);
