import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

test('dist/ and the generated files are up to date with their sources', () => {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs'), '--check'], { stdio: 'pipe' })
})

test('every --cx-* a stylesheet reads is declared somewhere in the kit', () => {
  const declared = new Set()
  const sheets = []
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const path = join(dir, name)
      if (statSync(join(ROOT, path)).isDirectory()) walk(path)
      else if (/\.(css|scss)$/.test(name)) sheets.push(path)
    }
  }
  walk('dist')
  walk('_extensions/chromokit')
  for (const path of sheets) for (const m of read(path).matchAll(/(--cx-[a-z0-9-]+)\s*:/g)) declared.add(m[1])
  const missing = new Set()
  for (const path of sheets) {
    for (const m of read(path).matchAll(/var\((--cx-[a-z0-9-]+)\s*[,)]/g)) if (!declared.has(m[1])) missing.add(`${m[1]} (${path})`)
  }
  assert.deepEqual([...missing], [])
})

test('the two palettes name the same tokens', () => {
  const tokens = JSON.parse(read('dist/tokens/tokens.json'))
  assert.deepEqual(Object.keys(tokens.light).sort(), Object.keys(tokens.dark).sort())
  for (const mode of ['light', 'dark']) {
    for (const [name, value] of Object.entries(tokens[mode])) {
      if (!name.startsWith('shadow')) assert.match(value, /^#[0-9a-f]{6}([0-9a-f]{2})?$/i, `${mode}.${name}`)
    }
  }
})

test('tokens.css carries each host\'s light/dark switch', () => {
  const css = read('dist/css/tokens.css')
  for (const selector of [
    ":root[data-theme='dark']",
    "[data-md-color-scheme='slate']",
    ":root[data-bs-theme='dark']",
    'body.quarto-dark',
    '.cx-dark',
    '.cx-paper',
    '@media (prefers-color-scheme: dark)',
  ]) {
    assert.ok(css.includes(selector), selector)
  }
})

test('the pkgdown Sass has nothing libsass would evaluate', () => {
  const scss = read('dist/pkgdown/extra.scss').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(scss, /\brgba?\([^)]*\//)
  assert.doesNotMatch(scss, /[^-\w](min|max)\(/)
  assert.equal(read('r/inst/pkgdown/BS5/extra.scss'), read('dist/pkgdown/extra.scss'))
})

test('the Quarto extension declares its formats and its files exist', () => {
  const yml = read('_extensions/chromokit/_extension.yml')
  for (const file of ['chromokit-light.scss', 'chromokit-dark.scss', 'chromokit-reveal.scss', 'chromokit.html']) {
    assert.ok(yml.includes(file), file)
    assert.ok(statSync(join(ROOT, '_extensions', 'chromokit', file)).size > 0)
  }
  for (const file of ['chromokit-light.scss', 'chromokit-dark.scss']) {
    const scss = read(`_extensions/chromokit/${file}`)
    assert.ok(scss.includes('/*-- scss:defaults --*/') && scss.includes('/*-- scss:rules --*/'))
  }
  const version = JSON.parse(read('package.json')).version
  assert.match(yml, new RegExp(`^version: ${version.replace(/\./g, '\\.')}$`, 'm'))
})

test('the R package and the npm package agree on the version', () => {
  const version = JSON.parse(read('package.json')).version
  assert.match(read('r/DESCRIPTION'), new RegExp(`^Version: ${version.replace(/\./g, '\\.')}$`, 'm'))
})
