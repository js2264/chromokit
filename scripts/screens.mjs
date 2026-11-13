#!/usr/bin/env node
/**
 * Screenshots of chromokit's site and of every example site, light and dark.
 *
 *     node scripts/screens.mjs [site-dir] [out-dir]     (defaults: site/_build, screens)
 *
 * Serves the built site on a local port and drives Chromium through each page:
 * the gallery and the docs pages, then each starter under examples/<target>/
 * when it is there. Quarto's pages start light whatever the system says, so in
 * the dark pass its toggle is pressed. Needs Playwright (`npm i -D playwright`
 * and `npx playwright install chromium`).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'

const [siteDir = 'site/_build', outDir = 'screens'] = process.argv.slice(2)
const ROOT = resolve(siteDir)
const OUT = resolve(outDir)
mkdirSync(OUT, { recursive: true })

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml' }

const server = createServer((req, res) => {
  let path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
  if (!path.startsWith(ROOT) || !existsSync(path)) {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
  createReadStream(path).pipe(res)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const base = `http://127.0.0.1:${server.address().port}`

/** name → path, and whether to take the whole page. */
const PAGES = [
  ['site-home', '/index.html'],
  ['site-gallery', '/gallery.html', true],
  ['site-start', '/start.html'],
  ['site-tokens', '/tokens.html'],
]
const EXAMPLES = {
  html: ['/', 'docs.html'],
  hugo: ['/', 'docs/quickstart/'],
  zensical: ['/', 'quickstart/'],
  sphinx: ['/', 'quickstart.html'],
  starlight: ['/', 'guides/quickstart/'],
  quarto: ['/', 'getting-started.html'],
  pkgdown: ['/', 'articles/examplepkg.html'],
  r: ['/', 'reference/theme_chromokit.html'],
}
for (const [target, paths] of Object.entries(EXAMPLES)) {
  // The R package's site is published at /r/, the others under /examples/.
  const at = target === 'r' ? 'r' : `examples/${target}`
  if (!existsSync(join(ROOT, at))) continue
  paths.forEach((path, i) => PAGES.push([`${target}-${i === 0 ? 'home' : 'page'}`, `/${at}/${path === '/' ? '' : path}`]))
}

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('screens.mjs needs Playwright: npm i -D playwright && npx playwright install chromium')
  server.close()
  process.exit(1)
}

const browser = await chromium.launch()
const failures = []
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, colorScheme: scheme })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const [name, path, full] of PAGES) {
    errors.length = 0
    const response = await page.goto(`${base}${path}`, { waitUntil: 'load' })
    if (!response || !response.ok()) {
      failures.push(`${name}: HTTP ${response?.status()}`)
      continue
    }
    await page.waitForTimeout(400)
    if (scheme === 'dark') {
      const quartoLight = await page.evaluate(() => document.body.classList.contains('quarto-light'))
      if (quartoLight && (await page.$('.quarto-color-scheme-toggle'))) {
        await page.click('.quarto-color-scheme-toggle')
        await page.waitForTimeout(300)
      }
    }
    await page.screenshot({ path: join(OUT, `${name}-${scheme}.png`), fullPage: Boolean(full) })
    if (errors.length > 0) failures.push(`${name} (${scheme}): ${errors.join('; ')}`)
    console.log(`${name}-${scheme}.png`)
  }
  await context.close()
}
await browser.close()
server.close()
if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):\n${failures.join('\n')}`)
  process.exitCode = 1
}
