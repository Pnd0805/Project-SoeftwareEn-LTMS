// Run against each equivalent production build; this is a local lab trace.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const zlib = require('node:zlib')
const { chromium } = require('/private/tmp/ltms-ticket1-browser/node_modules/playwright')
const dist = path.resolve('dist')
const out = path.resolve('docs/superpowers/notes/quality20')
const stage = process.argv[2]
;(async () => {
  const chunks = fs.readdirSync(path.join(dist, 'assets')).filter(name => name.endsWith('.js')).map(name => {
    const bytes = fs.readFileSync(path.join(dist, 'assets', name))
    return { name, bytes: bytes.length, gzip: zlib.gzipSync(bytes).length }
  })
  const server = http.createServer((req, res) => {
    const name = req.url.split('?')[0]
    const file = path.join(dist, name.includes('.') ? name : 'index.html')
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.woff2') ? 'font/woff2' : 'text/html')
    try { res.end(fs.readFileSync(file)) } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' })
  try {
    const traces = []
    for (let sample = 0; sample < 3; sample++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.route('**/api/v1/**', route => route.abort())
      await page.goto(`http://127.0.0.1:${server.address().port}/`)
      await page.locator('h1').first().waitFor()
      traces.push(await page.evaluate(() => ({ heading: document.querySelector('h1').textContent, navigation: performance.getEntriesByType('navigation')[0].toJSON(), scripts: performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js')).map(r => ({ name: r.name.split('/').pop(), duration: r.duration, bytes: r.encodedBodySize })) })))
      await context.close()
    }
    fs.writeFileSync(path.join(out, `bundle-${stage}.json`), JSON.stringify({ chunks, traces }, null, 2) + '\n')
    console.log(JSON.stringify({ chunks, samples: traces.length }))
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
})().catch(error => { console.error(error); process.exit(1) })
