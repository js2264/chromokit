import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { add, check, init, KITS, main, sync, targets, UsageError } from '../lib/cli.mjs'

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

// ---------------------------------------------------------------- kits beside the site

/** A Python project: pyproject.toml and src/<name>/__init__.py. */
function pythonProject(dir, name = 'toolkit', distribution = name) {
  writeFileSync(join(dir, 'pyproject.toml'), `[project]\nname = "${distribution}"\nversion = "1.0.0"\n`)
  mkdirSync(join(dir, 'src', name), { recursive: true })
  writeFileSync(join(dir, 'src', name, '__init__.py'), '')
  return dir
}

const kitDist = join(new URL('..', import.meta.url).pathname, 'dist', 'report')

test('there is a report kit, and `kits` lists it', () => {
  assert.deepEqual(Object.keys(KITS), ['report'])
  const out = []
  assert.equal(main(['kits'], (line) => out.push(line)), 0)
  assert.match(out.join('\n'), /^report\s+A tool's report/)
})

test('add report: the kit in src/<package>/_report/, recorded beside the site, checked and synced with it', () => {
  const dir = pythonProject(scratch())
  init('zensical', dir, FLAGS)
  const { log, placement } = add('report', dir)
  assert.deepEqual(placement, { package: 'toolkit', dir: 'src/toolkit/_report' })
  const manifest = JSON.parse(readFileSync(join(dir, 'chromokit.json'), 'utf8'))
  assert.deepEqual(Object.keys(manifest), ['$comment', 'version', 'target', 'files', 'report'])
  assert.equal(manifest.target, 'zensical')
  assert.deepEqual(
    Object.keys(manifest.report.files).sort(),
    readdirSync(kitDist).map((name) => `src/toolkit/_report/${name}`).sort(),
  )
  for (const name of readdirSync(kitDist)) {
    assert.ok(readFileSync(join(dir, 'src/toolkit/_report', name)).equals(readFileSync(join(kitDist, name))), name)
  }
  assert.ok(log.some((line) => line.startsWith('kit      src/toolkit/_report/__init__.py')))
  const result = check(dir)
  assert.equal(result.ok, true)
  assert.deepEqual(result.names, ['zensical', 'report'])
  assert.equal(result.count, Object.keys(manifest.files).length + Object.keys(manifest.report.files).length)

  // An edit to the kit is refused by check and by sync, and --force restores it.
  const module = join(dir, 'src/toolkit/_report/__init__.py')
  writeFileSync(module, `${readFileSync(module, 'utf8')}\nMINE = 1\n`)
  rmSync(join(dir, 'src/toolkit/_report/report.js'))
  assert.deepEqual(check(dir).problems.sort(), ['edited   src/toolkit/_report/__init__.py', 'missing  src/toolkit/_report/report.js'])
  assert.throws(() => sync(dir), /edited locally:\n {2}src\/toolkit\/_report\/__init__\.py/)
  sync(dir, { force: true })
  assert.equal(check(dir).ok, true)
  // Twice is refused: sync updates it.
  assert.throws(() => add('report', dir), /already has the report kit, in src\/toolkit\/_report/)
})

test('add report: without a site, a manifest of the kit alone; init then adds the site and keeps it', () => {
  const dir = pythonProject(scratch())
  add('report', dir)
  let manifest = JSON.parse(readFileSync(join(dir, 'chromokit.json'), 'utf8'))
  assert.deepEqual(Object.keys(manifest), ['$comment', 'version', 'report'])
  assert.deepEqual(check(dir).names, ['report'])
  assert.deepEqual(sync(dir).log, [`chromokit ${manifest.version} → ${manifest.version}: 0 files updated`])
  init('zensical', dir, FLAGS)
  manifest = JSON.parse(readFileSync(join(dir, 'chromokit.json'), 'utf8'))
  assert.deepEqual(Object.keys(manifest), ['$comment', 'version', 'target', 'files', 'report'])
  assert.equal(check(dir).ok, true)
})

test('add report: which package', () => {
  // The distribution's name when src/ has several packages, --package otherwise.
  const two = pythonProject(scratch(), 'first', 'second')
  mkdirSync(join(two, 'src', 'second'))
  writeFileSync(join(two, 'src', 'second', '__init__.py'), '')
  assert.equal(add('report', two).placement.dir, 'src/second/_report')
  const flat = scratch()
  writeFileSync(join(flat, 'pyproject.toml'), '[project]\nname = "flat-tool"\n')
  mkdirSync(join(flat, 'flat_tool'))
  writeFileSync(join(flat, 'flat_tool', '__init__.py'), '')
  assert.equal(add('report', flat).placement.dir, 'flat_tool/_report')
  const named = pythonProject(scratch(), 'one')
  assert.throws(() => add('report', named, { package: 'other' }), /no package other/)
  assert.throws(() => add('report', scratch()), /no Python package found/)
  const many = scratch()
  for (const name of ['a', 'b']) {
    mkdirSync(join(many, 'src', name), { recursive: true })
    writeFileSync(join(many, 'src', name, '__init__.py'), '')
  }
  assert.throws(() => add('report', many), /several packages under .*: name one with --package/)
  assert.equal(add('report', many, { package: 'b' }).placement.dir, 'src/b/_report')
  assert.throws(() => add('nope', many), /unknown kit "nope"/)
})

test("add report: a file of the kit's name that is not chromokit's is refused, and --force moves the kit", () => {
  const dir = pythonProject(scratch())
  mkdirSync(join(dir, 'src/toolkit/_report'))
  writeFileSync(join(dir, 'src/toolkit/_report/__init__.py'), '# mine\n')
  assert.throws(() => add('report', dir), /src\/toolkit\/_report\/__init__\.py exists and is not chromokit's/)
  add('report', dir, { force: true })
  mkdirSync(join(dir, 'src', 'other'))
  writeFileSync(join(dir, 'src', 'other', '__init__.py'), '')
  const { log } = add('report', dir, { force: true, package: 'other' })
  assert.ok(log.includes('removed  src/toolkit/_report/__init__.py'))
  assert.equal(existsSync(join(dir, 'src/toolkit/_report/__init__.py')), false)
  assert.equal(check(dir).ok, true)
})

test('add --dry-run writes nothing', () => {
  const dir = pythonProject(scratch())
  const { log } = add('report', dir, { dryRun: true })
  assert.ok(log.length > 0)
  assert.equal(existsSync(join(dir, 'chromokit.json')), false)
  assert.equal(existsSync(join(dir, 'src/toolkit/_report')), false)
})

test('a manifest as chromokit 0.1.0 wrote it checks and syncs as it did, and takes the report kit', () => {
  // hicstuff's, metaTOR's and instaGRAAL's: "target": "zensical", and the six files' hashes.
  const dir = scratch()
  const old = scratch()
  init('zensical', old, FLAGS)
  const files = JSON.parse(readFileSync(join(old, 'chromokit.json'), 'utf8')).files
  for (const path of Object.keys(files)) cpSync(join(old, path), join(dir, path), { recursive: true })
  const comment =
    "Written by chromokit (https://github.com/js2264/chromokit). The files listed are the kit's: `npx github:js2264/chromokit sync` replaces them and `… check` refuses local edits. Put local changes in your own stylesheet instead."
  writeFileSync(join(dir, 'chromokit.json'), `${JSON.stringify({ $comment: comment, version: '0.1.0', target: 'zensical', files }, null, 2)}\n`)
  const out = []
  assert.equal(main(['check', dir], (line) => out.push(line)), 0)
  assert.match(out[0], new RegExp(`^chromokit 0\\.1\\.0 \\(zensical\\): all ${Object.keys(files).length} kit files as written$`))
  sync(dir)
  assert.equal(check(dir).ok, true)
  pythonProject(dir)
  add('report', dir)
  const manifest = JSON.parse(readFileSync(join(dir, 'chromokit.json'), 'utf8'))
  assert.equal(manifest.target, 'zensical')
  assert.deepEqual(manifest.files, files)
  assert.equal(check(dir).ok, true)
})

test('add needs a kit; add report on the command line', () => {
  const err = []
  assert.equal(main(['add'], () => {}, (line) => err.push(line)), 2)
  assert.match(err.join('\n'), /add needs a kit/)
  const dir = pythonProject(scratch())
  const out = []
  assert.equal(main(['add', 'report', dir], (line) => out.push(line)), 0)
  assert.match(out.join('\n'), /Next:\n {2}from \._report import/)
  out.length = 0
  assert.equal(main(['check', dir], (line) => out.push(line)), 0)
  assert.match(out[0], /\(report\): all \d+ kit files as written/)
})
