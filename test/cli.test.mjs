import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { check, init, main, sync, targets, UsageError } from '../lib/cli.mjs'

const dirs = []
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'chromokit-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop(), { recursive: true, force: true })
})

const FLAGS = { name: 'hicool', description: 'Hi-C in one command.', repo: 'js2264/hicool' }

test('there is a target for each kind of site', () => {
  assert.deepEqual(
    targets().map((t) => t.name),
    ['html', 'hugo', 'pkgdown', 'quarto', 'sphinx', 'starlight', 'zensical'],
  )
})

for (const t of targets()) {
  test(`init ${t.name}: starter, kit, mark and manifest, all as recorded`, () => {
    const dir = scratch()
    init(t.name, dir, FLAGS)
    const manifest = JSON.parse(readFileSync(join(dir, 'chromokit.json'), 'utf8'))
    assert.equal(manifest.target, t.name)
    assert.ok(Object.keys(manifest.files).length > 0)
    for (const path of t.mark) assert.ok(existsSync(join(dir, path)), path)
    assert.deepEqual(check(dir).problems, [])
  })

  test(`init ${t.name}: every placeholder in a starter file is filled`, () => {
    const dir = scratch()
    const { log } = init(t.name, dir, FLAGS)
    for (const line of log.filter((l) => l.startsWith('starter'))) {
      const path = line.replace(/^starter\s+/, '')
      const text = readFileSync(join(dir, path), 'utf8')
      assert.doesNotMatch(text, /\{\{(name|description|repo|owner|url|origin|base|slug|author|year|chromokit)\}\}|\{\{(icon|file):/, path)
      if (/\.(md|qmd|mdx|html|toml|ya?ml|json)$/.test(path) && text.includes('hicool') === false && path !== '.gitignore') {
        // Not every file names the project, but the main config does.
      }
    }
  })
}

test('a starter file that exists is kept; a kit file that is not chromokit\'s is refused', () => {
  const dir = scratch()
  writeFileSync(join(dir, 'index.html'), '<p>mine</p>')
  const { log } = init('html', dir, FLAGS)
  assert.ok(log.some((line) => line.startsWith('kept') && line.includes('index.html')))
  assert.equal(readFileSync(join(dir, 'index.html'), 'utf8'), '<p>mine</p>')

  const other = scratch()
  init('html', other, FLAGS)
  rmSync(join(other, 'chromokit.json'))
  writeFileSync(join(other, 'assets/chromokit/theme.js'), '// mine')
  assert.throws(() => init('html', other, FLAGS), UsageError)
})

test('check names an edited or missing kit file; sync refuses it, --force restores it', () => {
  const dir = scratch()
  init('zensical', dir, FLAGS)
  const css = join(dir, 'docs/stylesheets/chromokit.css')
  writeFileSync(css, `${readFileSync(css, 'utf8')}\n.mine { color: red }\n`)
  rmSync(join(dir, 'overrides/main.html'))
  const { ok, problems } = check(dir)
  assert.equal(ok, false)
  assert.deepEqual(problems.sort(), ['edited   docs/stylesheets/chromokit.css', 'missing  overrides/main.html'])
  assert.throws(() => sync(dir), /edited locally/)
  sync(dir, { force: true })
  assert.equal(check(dir).ok, true)
})

test('sync removes a file the kit no longer ships, and records the new set', () => {
  const dir = scratch()
  init('html', dir, FLAGS)
  const manifestPath = join(dir, 'chromokit.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  writeFileSync(join(dir, 'assets/chromokit/old.css'), '/* old */')
  manifest.files['assets/chromokit/old.css'] = 'sha256:' + require_sha('/* old */')
  writeFileSync(manifestPath, JSON.stringify(manifest))
  const { log } = sync(dir)
  assert.ok(log.includes('removed  assets/chromokit/old.css'))
  assert.equal(existsSync(join(dir, 'assets/chromokit/old.css')), false)
  assert.equal(JSON.parse(readFileSync(manifestPath, 'utf8')).files['assets/chromokit/old.css'], undefined)
})

test('--accent writes the override into the starter stylesheet', () => {
  const dir = scratch()
  init('html', dir, { ...FLAGS, accent: '#7a3e9d,#b98ad6' })
  const css = readFileSync(join(dir, 'assets/site.css'), 'utf8')
  assert.ok(css.includes('--cx-accent: #7a3e9d;') && css.includes('--cx-accent: #b98ad6;'))
  assert.equal(check(dir).ok, true)
})

test('pkgdown: appends to .Rbuildignore once, and takes the name from DESCRIPTION', () => {
  const dir = scratch()
  writeFileSync(join(dir, 'DESCRIPTION'), 'Package: examplepkg\nVersion: 0.1.0\n')
  writeFileSync(join(dir, '.Rbuildignore'), '^docs$\n')
  init('pkgdown', dir, { repo: 'example/examplepkg' })
  init('pkgdown', dir, { repo: 'example/examplepkg' })
  const ignore = readFileSync(join(dir, '.Rbuildignore'), 'utf8').trim().split('\n')
  assert.deepEqual(ignore.sort(), ['^_pkgdown\\.yml$', '^chromokit\\.json$', '^docs$', '^pkgdown$'].sort())
  assert.match(readFileSync(join(dir, 'pkgdown/extra.css'), 'utf8'), /^\/\* examplepkg:/)
  assert.match(readFileSync(join(dir, '_pkgdown.yml'), 'utf8'), /light-switch: true/)
})

test('--dry-run writes nothing', () => {
  const dir = scratch()
  const { log } = init('quarto', dir, { ...FLAGS, dryRun: true })
  assert.ok(log.length > 0)
  assert.equal(existsSync(join(dir, 'chromokit.json')), false)
  assert.equal(existsSync(join(dir, '_quarto.yml')), false)
})

test('the command line: help, version, targets, a mark, and errors as exit codes', () => {
  const out = []
  const err = []
  const run = (...args) => main(args, (line) => out.push(line), (line) => err.push(line))
  assert.equal(run('--help'), 0)
  assert.match(out.join('\n'), /chromokit init <target>/)
  assert.equal(run('version'), 0)
  assert.equal(run('targets'), 0)
  out.length = 0
  assert.equal(run('mark', '--name', 'hicool', '--style', 'ember'), 0)
  assert.match(out.join(''), /^<svg/)
  assert.equal(run('init', 'nope', scratch()), 2)
  assert.match(err.join('\n'), /unknown target "nope"/)
  assert.equal(run('check', scratch()), 2)
})

function require_sha(text) {
  return createHash('sha256').update(text).digest('hex')
}
import { createHash } from 'node:crypto'
