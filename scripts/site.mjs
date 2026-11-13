#!/usr/bin/env node
/**
 * Build chromokit's own site into site/_build/: the landing page, the gallery,
 * the tokens, the getting-started page, and the index of example sites (which
 * .github/workflows/site.yml builds from every starter into examples/<target>/).
 *
 * The site is a plain-HTML chromokit site itself: dist/css/chromokit-page.css,
 * the scripts, and the same `{{icon:…}}` placeholders the starters use.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fill, targets, VERSION } from '../lib/cli.mjs'
import { markSvg } from '../lib/marks.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT = join(ROOT, 'site', '_build')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')
const tokens = JSON.parse(read('dist/tokens/tokens.json'))

const keep = existsSync(join(OUT, 'examples')) ? join(ROOT, '.tmp', 'examples-keep') : null
if (keep) {
  rmSync(keep, { recursive: true, force: true })
  mkdirSync(dirname(keep), { recursive: true })
  cpSync(join(OUT, 'examples'), keep, { recursive: true })
}
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'assets', 'chromokit'), { recursive: true })
if (keep) {
  cpSync(keep, join(OUT, 'examples'), { recursive: true })
  rmSync(keep, { recursive: true, force: true })
}

cpSync(join(ROOT, 'dist', 'css', 'chromokit-page.css'), join(OUT, 'assets', 'chromokit', 'chromokit.css'))
cpSync(join(ROOT, 'dist', 'js', 'theme.js'), join(OUT, 'assets', 'chromokit', 'theme.js'))
cpSync(join(ROOT, 'dist', 'js', 'chromokit.js'), join(OUT, 'assets', 'chromokit', 'chromokit.js'))
cpSync(join(ROOT, 'dist', 'marks', 'chromokit.svg'), join(OUT, 'assets', 'chromokit-mark.svg'))
cpSync(join(ROOT, 'site', 'assets', 'site.css'), join(OUT, 'assets', 'site.css'))
// The kit itself, for anyone who wants a file without cloning.
cpSync(join(ROOT, 'dist'), join(OUT, 'dist'), { recursive: true })

const layout = read('site/layout.html')
const PAGES = [
  ['index.html', 'Home'],
  ['start.html', 'Get started'],
  ['gallery.html', 'Gallery'],
  ['tokens.html', 'Tokens'],
  ['examples/index.html', 'Example sites'],
]

function nav(current, root) {
  const items = PAGES.map(
    ([href, label]) =>
      `<li><a href="${root}${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a></li>`,
  ).join('')
  return `<nav class="cx-nav" aria-label="Pages"><ul><li class="cx-nav__group"><details open><summary>chromokit</summary><ul>${items}</ul></details></li></ul></nav>`
}

function toc(spec) {
  if (!spec) return ''
  const items = spec
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, ...label] = entry.split(' ')
      return `<li><a href="#${id}">${label.join(' ')}</a></li>`
    })
    .join('')
  return `<p class="cx-toc__title">On this page</p><ul>${items}</ul>`
}

const MARKS = [
  ['chromokit', 'genomes', 7],
  ['metacooler', 'genomes', 8],
  ['chromosomix', 'ember', 7],
  ['hicool', 'accent', 7],
  ['tidyCoverage', 'genomes', 9],
  ['HiContacts', 'ember', 6],
]
const marks = MARKS.map(
  ([name, style, cells]) =>
    `<figure><img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(markSvg({ name, style, cells }))}"><figcaption>${name}<br><code>${style}</code></figcaption></figure>`,
).join('')

function swatchRows(mode) {
  return Object.entries(tokens[mode])
    .map(([name, value]) => {
      const colour = value.startsWith('#') ? `<span class="swatch" style="background:${value}"></span> ` : ''
      return `<tr><td><code>--cx-${name}</code></td><td>${colour}<code>${value}</code></td></tr>`
    })
    .join('\n')
}

const tokensPage = `<!-- title: Tokens · chromokit -->
<!-- toc: light The light palette; dark The dark palette; base Type and measures; files Where they are -->
<div class="cx-layout">
  <aside class="cx-sidebar">{{nav}}</aside>
  <main class="cx-main cx-ground">
    <article class="cx-content cx-prose">
      <h1>Tokens</h1>
      <p>Every value chromokit draws with, as custom properties named <code>--cx-&lt;name&gt;</code>. The palettes are chromosomix's own, snapshotted from <a href="${tokens.source.repository}/blob/${tokens.source.commit}/${tokens.source.path}"><code>${tokens.source.path}</code> at ${tokens.source.commit.slice(0, 7)}</a>; the syntax colours are Vitesse's.</p>
      <h2 id="light">The light palette</h2>
      <div class="cx-table-wrap"><table class="cx-table"><thead><tr><th>Token</th><th>Value</th></tr></thead><tbody>${swatchRows('light')}</tbody></table></div>
      <h2 id="dark">The dark palette</h2>
      <div class="cx-table-wrap"><table class="cx-table"><thead><tr><th>Token</th><th>Value</th></tr></thead><tbody>${swatchRows('dark')}</tbody></table></div>
      <h2 id="base">Type and measures</h2>
      <div class="cx-table-wrap"><table class="cx-table"><thead><tr><th>Token</th><th>Value</th></tr></thead><tbody>
        <tr><td><code>--cx-sans</code></td><td><code>${tokens.base.sans}</code></td></tr>
        <tr><td><code>--cx-mono</code></td><td><code>${tokens.base.mono}</code></td></tr>
        <tr><td><code>--cx-radius</code></td><td><code>${tokens.base.radius}</code></td></tr>
        ${Object.entries(tokens.base.steps)
          .map(([name, value]) => `<tr><td><code>--cx-${name}</code></td><td><code>${value}</code> × <code>--cx-rem</code></td></tr>`)
          .join('')}
        ${Object.entries(tokens.base.layout)
          .map(([name, value]) => `<tr><td><code>--cx-${name}</code></td><td><code>${value}</code></td></tr>`)
          .join('')}
      </tbody></table></div>
      <p><code>--cx-rem</code> is <code>1rem</code>; a host whose root font size is not 16px (Zensical's is 20px) sets it so the components keep their size.</p>
      <h2 id="files">Where they are</h2>
      <ul>
        <li><a href="../dist/css/tokens.css"><code>dist/css/tokens.css</code></a> — custom properties, both palettes, on every host's light/dark switch</li>
        <li><a href="../dist/scss/_tokens.scss"><code>dist/scss/_tokens.scss</code></a> — Sass maps and variables</li>
        <li><a href="../dist/tokens/tokens.json"><code>dist/tokens/tokens.json</code></a> and <code>tokens.mjs</code> — as data</li>
        <li><a href="../dist/brand/_brand.yml"><code>dist/brand/_brand.yml</code></a> — brand.yml, for Quarto, Shiny and bslib</li>
      </ul>
    </article>
  </main>
  <aside class="cx-toc">{{toc}}</aside>
</div>
`.replace(/\.\.\/dist\//g, 'dist/')

const ICON_FOR = {
  html: 'code',
  hugo: 'file-text',
  zensical: 'python',
  sphinx: 'book-open',
  starlight: 'sparkles',
  pkgdown: 'r',
  quarto: 'quarto',
}

const exampleTargets = targets()
const examplesPage = `<!-- title: Example sites · chromokit -->
<main class="cx-ground" style="min-height: calc(100vh - var(--cx-header-h))">
  <div class="cx-landing" style="padding-inline: 16px">
    <p class="cx-kicker" style="margin-top: 0">Example sites</p>
    <h1 style="margin: 0.4rem 0 0.6rem; font-size: var(--cx-prose-h1)">Every starter, built</h1>
    <p class="cx-dim" style="margin: 0 0 1.5rem">Each one is <code>chromokit init &lt;target&gt;</code> with nothing changed, built by its own tool on every push to main.</p>
    <div class="cx-tiles">
      ${exampleTargets
        .map(
          (t) =>
            `<a class="cx-tile" href="${t.name}/"><span class="cx-glyph">{{icon:${ICON_FOR[t.name] ?? 'file-text'}}}</span><strong>${t.title}</strong><span class="cx-tile-text">${t.description.split(':')[0].split('(')[0].trim()}</span></a>`,
        )
        .join('\n      ')}
      <a class="cx-tile" href="r/"><span class="cx-glyph">{{icon:r}}</span><strong>R template package</strong><span class="cx-tile-text">chromokit's own R package, built with template: package: chromokit</span></a>
    </div>
  </div>
</main>
`

function render(name, source) {
  const root = name.includes('/') ? '../' : ''
  const title = source.match(/<!-- title: (.*?) -->/)?.[1] ?? 'chromokit'
  const tocSpec = source.match(/<!-- toc: (.*?) -->/)?.[1]
  const body = source
    .replace(/<!-- (title|toc): .*? -->\n?/g, '')
    .replace('{{nav}}', nav(name, root))
    .replace('{{toc}}', toc(tocSpec))
    .replace('{{marks}}', marks)
    .replace(/(href|src)="(?!https?:|#|data:|\.\.\/|mailto:)([^"]+)"/g, (match, attr, path) =>
      attr === 'href' || attr === 'src' ? `${attr}="${root}${path}"` : match,
    )
  const html = fill(layout.replace('{{body}}', body).replace('{{title}}', title), {
    version: VERSION,
    root,
    commit: tokens.source.commit,
    short: tokens.source.commit.slice(0, 7),
  })
  const target = join(OUT, name)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, html)
}

for (const name of readdirSync(join(ROOT, 'site', 'pages'))) render(name, read(`site/pages/${name}`))
render('tokens.html', tokensPage)
render('examples/index.html', examplesPage)
writeFileSync(join(OUT, '.nojekyll'), '')
console.log(`built ${OUT}`)
