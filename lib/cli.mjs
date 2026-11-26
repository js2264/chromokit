/**
 * chromokit's command line: put the kit into a repository, keep it up to date,
 * and check that nobody edited the copied files.
 *
 *   chromokit init <target> [dir]   a starter site for <target>, with the kit's files
 *   chromokit add <kit> [dir]       a kit beside the site: `report`, a Python package's report
 *   chromokit sync [dir]            replace the kit's files with this version's
 *   chromokit check [dir]           exit 1 if a kit file was edited or removed
 *   chromokit mark                  draw a logo mark
 *   chromokit targets               list the targets
 *   chromokit kits                  list the kits `add` takes
 *
 * Two kinds of file are written. *Starter* files (a config, a home page, the
 * site's own stylesheet) are the project's from the moment they exist: init
 * writes them once, with the project's name filled in, and never again. *Kit*
 * files (stylesheets, templates, scripts) stay chromokit's: their hashes go in
 * `chromokit.json`, `sync` replaces them, and `check` refuses a local edit —
 * a local change belongs in the starter stylesheet, which loads after them.
 *
 * `chromokit.json` records the site as chromokit 0.1.0 wrote it (`target` and
 * `files`), and each kit added beside it under its own name, with the
 * directory it went to and its files (`report: { package, dir, files }`). A
 * manifest without a kit, as 0.1.0 wrote them all, reads as it always did.
 * One `version` covers everything the manifest lists: `add` brings the site's
 * files to this version too, as `sync` would.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MARK_STYLES, markSvg } from './marks.mjs'
import { accentCss } from './selectors.mjs'

export const KIT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const MANIFEST = 'chromokit.json'
export const VERSION = JSON.parse(readFileSync(join(KIT_ROOT, 'package.json'), 'utf8')).version

const TEXT = /\.(md|qmd|mdx|rmd|html|htm|astro|toml|ya?ml|json|css|scss|js|mjs|ts|txt|r|py|gitignore)$/i

const sha = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`

function walk(dir) {
  const out = []
  const visit = (here) => {
    for (const name of readdirSync(here).sort()) {
      const path = join(here, name)
      if (statSync(path).isDirectory()) visit(path)
      else out.push(path)
    }
  }
  visit(dir)
  return out
}

/** Every target, from templates/<name>/target.json. */
export function targets() {
  const dir = join(KIT_ROOT, 'templates')
  return readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, 'target.json')))
    .sort()
    .map((name) => ({ name, ...JSON.parse(readFileSync(join(dir, name, 'target.json'), 'utf8')) }))
}

export function target(name) {
  const found = targets().find((t) => t.name === name)
  if (!found) throw new UsageError(`unknown target "${name}"; one of: ${targets().map((t) => t.name).join(', ')}`)
  return found
}

/** The kit's files for a target: destination path → contents. */
export function kitFiles(t) {
  const files = new Map()
  for (const [dest, src] of Object.entries(t.kit ?? {})) {
    const from = join(KIT_ROOT, src)
    if (!existsSync(from)) throw new Error(`the kit has no ${src} (run npm run build in chromokit)`)
    if (statSync(from).isDirectory()) {
      for (const path of walk(from)) files.set(join(dest, relative(from, path)).split('\\').join('/'), readFileSync(path))
    } else {
      files.set(dest, readFileSync(from))
    }
  }
  return files
}

/**
 * The kits a project adds beside its site, with `chromokit add <kit>`: each
 * one a folder of dist/ copied into the project as it is, in a folder that
 * depends on the project (`where`), and recorded in chromokit.json under its
 * own name.
 */
export const KITS = {
  report: {
    title: 'Report kit',
    description:
      "A tool's report of a run: report.txt, its MultiQC row and its page, from metaTOR's report (src/<package>/_report/).",
    from: 'dist/report',
    where: (dir, flags) => {
      const pkg = pythonPackage(dir, flags.package)
      return { package: pkg.name, dir: `${pkg.dir}/_report` }
    },
    next: (placed) => [
      `from ._report import Report, Tool, read_txt, report_files, write_report   # in ${placed.package}'s report module`,
      'add jinja2>=3.1 and pyyaml>=6.0 to [project] dependencies (read_txt also needs pandas)',
      `a page of your own: a Jinja2 template that starts {% extends "_report/base.html.j2" %}`,
    ],
  },
}

export function kit(name) {
  const found = KITS[name]
  if (!found) throw new UsageError(`unknown kit "${name}"; one of: ${Object.keys(KITS).join(', ')}`)
  return found
}

/**
 * Where a Python package's import package lives: `src/<name>/` or `<name>/`,
 * with an `__init__.py`. Named by `--package`, or else the only package under
 * src/, or else the distribution's name in pyproject.toml.
 */
export function pythonPackage(dir, name) {
  const isPackage = (path) => existsSync(join(dir, path, '__init__.py'))
  if (name) {
    for (const path of [`src/${name}`, name]) if (isPackage(path)) return { name, dir: path }
    throw new UsageError(`no package ${name} in ${dir}: neither src/${name}/__init__.py nor ${name}/__init__.py`)
  }
  const src = join(dir, 'src')
  const found = existsSync(src) ? readdirSync(src).filter((entry) => isPackage(`src/${entry}`)).sort() : []
  if (found.length === 1) return { name: found[0], dir: `src/${found[0]}` }
  const distribution = existsSync(join(dir, 'pyproject.toml'))
    ? readFileSync(join(dir, 'pyproject.toml'), 'utf8').match(/^\[project\][^[]*?^name\s*=\s*["']([^"']+)["']/ms)?.[1]
    : undefined
  const guess = distribution?.toLowerCase().replace(/[-.]+/g, '_')
  if (guess) for (const path of [`src/${guess}`, guess]) if (isPackage(path)) return { name: guess, dir: path }
  throw new UsageError(
    found.length > 1
      ? `several packages under ${src} (${found.join(', ')}): name one with --package`
      : `no Python package found in ${dir}: name it with --package`,
  )
}

/** A kit's files, placed in the project's folder for it: destination path → contents. */
export function kitFilesAt(k, folder) {
  return kitFiles({ kit: { [folder]: k.from } })
}

/** The starter's files, placeholders filled in: destination path → contents. */
export function starterFiles(t, values) {
  const dir = join(KIT_ROOT, 'templates', t.name, 'files')
  const files = new Map()
  if (!existsSync(dir)) return files
  for (const path of walk(dir)) {
    const dest = relative(dir, path).split('\\').join('/').replace(/(^|\/)_gitignore$/, '$1.gitignore')
    const raw = readFileSync(path)
    files.set(dest, TEXT.test(dest) || basename(dest) === '.gitignore' ? Buffer.from(fill(raw.toString('utf8'), values)) : raw)
  }
  return files
}

export function fill(text, values) {
  return text
    .replace(/\{\{file:([\w./-]+)\}\}/g, (match, path) => kitText(path) ?? match)
    .replace(/\{\{icon:([a-z0-9-]+)\}\}/g, (match, name) => iconSvg(name) ?? match)
    .replace(/\{\{\s*([a-z]+)\s*\}\}/g, (match, key) => (key in values ? String(values[key]) : match))
}

/** A file of the kit's, its generated-file comment line dropped, for `{{file:<path>}}` in a starter file. */
function kitText(path) {
  const absolute = join(KIT_ROOT, path)
  if (!existsSync(absolute)) return null
  return readFileSync(absolute, 'utf8')
    .split('\n')
    .filter((line) => !/^(#|\/\/) chromokit \d/.test(line))
    .join('\n')
    .trim()
}

/** One of the kit's icons as inline SVG, for `{{icon:<name>}}` in a starter file. */
function iconSvg(name) {
  const path = join(KIT_ROOT, 'dist', 'icons', `${name}.svg`)
  return existsSync(path) ? readFileSync(path, 'utf8').trim().replace(' xmlns="http://www.w3.org/2000/svg"', '') : null
}

/** What to call the project, where it lives, who wrote it: from flags, then git, then the folder. */
export function projectValues(dir, flags = {}) {
  const name = flags.name ?? packageName(dir) ?? basename(resolve(dir))
  let repo = flags.repo ?? null
  if (repo === null) {
    try {
      const url = execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/)
      if (match) repo = `${match[1]}/${match[2]}`
    } catch {
      /* not a git repository */
    }
  }
  repo ??= `OWNER/${name}`
  const [owner, repoName] = repo.split('/')
  const url = flags.url ?? `https://${owner.toLowerCase()}.github.io/${repoName}/`
  const path = new URL(url).pathname
  return {
    name,
    description: flags.description ?? `The documentation of ${name}.`,
    repo,
    owner,
    url,
    origin: new URL(url).origin,
    base: path.endsWith('/') ? path : `${path}/`,
    slug: name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'site',
    author: flags.author ?? `The ${name} authors`,
    year: String(new Date().getFullYear()),
    chromokit: VERSION,
  }
}

/** The name a package already gives itself: DESCRIPTION, pyproject.toml or package.json. */
function packageName(dir) {
  const read = (file) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : null)
  const description = read('DESCRIPTION')?.match(/^Package:\s*(\S+)/m)
  if (description) return description[1]
  const pyproject = read('pyproject.toml')?.match(/^\[project\][^[]*?^name\s*=\s*["']([^"']+)["']/ms)
  if (pyproject) return pyproject[1]
  try {
    const name = JSON.parse(read('package.json') ?? 'null')?.name
    if (typeof name === 'string') return name.replace(/^@[^/]+\//, '')
  } catch {
    /* not JSON */
  }
  return null
}

export class UsageError extends Error {}

function readManifest(dir) {
  const path = join(dir, MANIFEST)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

const COMMENT =
  "Written by chromokit (https://github.com/js2264/chromokit). The files listed are the kit's: `npx github:js2264/chromokit sync` replaces them and `… check` refuses local edits. Put local changes in your own files instead: your stylesheet, your report template."

const hashes = (files) =>
  Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, contents]) => [path, sha(contents)]))

/**
 * Write chromokit.json: the site (`target`, `files`) as 0.1.0 wrote it, then
 * each kit added beside it, under its name, with where it went and its files.
 */
function writeManifest(dir, { target: siteTarget, files, kits = {} }) {
  const manifest = { $comment: COMMENT, version: VERSION }
  if (siteTarget) Object.assign(manifest, { target: siteTarget, files: hashes(files) })
  for (const name of Object.keys(KITS)) {
    if (kits[name]) manifest[name] = { ...kits[name].placement, files: hashes(kits[name].files) }
  }
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

/**
 * What chromokit put in a project, part by part: its site, and each kit added
 * beside it. Each part has the files the manifest recorded and the files this
 * version ships, in the same place.
 */
function parts(dir, manifest) {
  const out = []
  if (manifest.target) {
    const t = target(manifest.target)
    out.push({ name: t.name, recorded: manifest.files ?? {}, files: kitFiles(t) })
  }
  for (const name of Object.keys(KITS)) {
    if (!manifest[name]?.files) continue
    const { files: recorded, ...placement } = manifest[name]
    out.push({ name, placement, recorded, files: kitFilesAt(KITS[name], placement.dir) })
  }
  return out
}

/** How to bring a part to this version: the files edited locally, those to remove, those to write. */
function plan(dir, part) {
  const current = (path) => (existsSync(join(dir, path)) ? readFileSync(join(dir, path)) : null)
  const edited = Object.entries(part.recorded)
    .filter(([path, recorded]) => current(path) !== null && sha(current(path)) !== recorded)
    .map(([path]) => path)
  const removed = Object.keys(part.recorded).filter((path) => !part.files.has(path) && current(path) !== null)
  const changed = [...part.files].filter(([path, contents]) => !current(path)?.equals(contents)).map(([path]) => path)
  return { ...part, edited, removed, changed }
}

function refuseEdited(plans, flags) {
  const edited = plans.flatMap((p) => p.edited)
  if (edited.length > 0 && !flags.force) {
    throw new UsageError(
      `these kit files were edited locally:\n  ${edited.join('\n  ')}\nmove the change into your own files, or run sync --force to overwrite`,
    )
  }
}

/** Remove and write what the plans say; returns how many files were written. */
function apply(dir, plans, flags, log) {
  let changed = 0
  for (const p of plans) {
    for (const path of p.removed) {
      if (!flags.dryRun) rmSync(join(dir, path))
      log.push(`removed  ${path}`)
    }
    for (const path of p.changed) {
      if (!flags.dryRun) write(dir, path, p.files.get(path))
      changed += 1
      log.push(`updated  ${path}`)
    }
  }
  return changed
}

/** The added kits of a set of parts, as writeManifest takes them. */
const kitsOf = (plans) => Object.fromEntries(plans.filter((p) => p.placement).map((p) => [p.name, p]))

const write = (dir, path, contents) => {
  const absolute = join(dir, path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, contents)
}

/**
 * Put a starter site and the kit into `dir`.
 * Returns what it did, as lines, for the caller to print.
 */
export function init(targetName, dir, flags = {}) {
  const t = target(targetName)
  const values = projectValues(dir, flags)
  const log = []
  const existing = readManifest(dir)
  if (existing?.target && existing.target !== t.name && !flags.force) {
    throw new UsageError(`${dir} already has chromokit for "${existing.target}"; use --force to add "${t.name}" over it`)
  }
  // The kits added beside the site come to this version with it.
  const others = existing ? parts(dir, existing).filter((p) => p.placement).map((p) => plan(dir, p)) : []
  refuseEdited(others, flags)
  mkdirSync(dir, { recursive: true })

  for (const [path, contents] of starterFiles(t, values)) {
    if (existsSync(join(dir, path)) && !flags.force) {
      log.push(`kept     ${path} (yours already)`)
      continue
    }
    if (!flags.dryRun) write(dir, path, contents)
    log.push(`starter  ${path}`)
  }

  const files = kitFiles(t)
  for (const [path, contents] of files) {
    const recorded = existing?.files?.[path]
    const current = existsSync(join(dir, path)) ? readFileSync(join(dir, path)) : null
    if (current && recorded === undefined && !flags.force && !current.equals(contents)) {
      throw new UsageError(`${path} exists and is not chromokit's; move it aside or use --force`)
    }
    if (!flags.dryRun) write(dir, path, contents)
    log.push(`kit      ${path}`)
  }

  if (flags.mark !== false) {
    const svg = markSvg({ name: values.name, style: flags.markStyle ?? 'genomes', cells: Number(flags.cells ?? 7) })
    for (const path of t.mark ?? []) {
      if (existsSync(join(dir, path)) && !flags.force) {
        log.push(`kept     ${path} (yours already)`)
        continue
      }
      if (!flags.dryRun) write(dir, path, svg)
      log.push(`mark     ${path}`)
    }
  }

  for (const [path, lines] of Object.entries(t.append ?? {})) {
    const absolute = join(dir, path)
    const before = existsSync(absolute) ? readFileSync(absolute, 'utf8') : ''
    const have = new Set(before.split('\n'))
    const missing = lines.filter((line) => !have.has(line))
    if (missing.length === 0) continue
    if (!flags.dryRun) write(dir, path, `${before}${before === '' || before.endsWith('\n') ? '' : '\n'}${missing.join('\n')}\n`)
    log.push(`append   ${path} (${missing.length} line${missing.length === 1 ? '' : 's'})`)
  }

  if (flags.accent && t.accent) {
    const [light, dark] = String(flags.accent).split(',')
    const css = `\n/* The project's accent, over chromokit's blue (chromokit init --accent). */\n${accentCss(light, dark ?? light)}\n`
    if (!flags.dryRun) {
      const path = join(dir, t.accent)
      const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
      write(dir, t.accent, before + css)
    }
    log.push(`accent   ${t.accent}`)
  }

  apply(dir, others, flags, log)
  if (!flags.dryRun) writeManifest(dir, { target: t.name, files, kits: kitsOf(others) })
  log.push(`manifest ${MANIFEST} (chromokit ${VERSION}, ${t.name})`)
  return { log, next: t.next ?? [], values }
}

/**
 * Add a kit beside the site (`report`: src/<package>/_report/), and bring
 * what chromokit.json already lists to this version, as sync does. A manifest
 * is started when there is none: the kit needs no site.
 */
export function add(kitName, dir, flags = {}) {
  const k = kit(kitName)
  const existing = readManifest(dir) ?? {}
  if (existing[kitName] && !flags.force) {
    throw new UsageError(`${dir} already has the ${kitName} kit, in ${existing[kitName].dir}: \`chromokit sync\` updates it`)
  }
  const placement = k.where(dir, flags)
  const files = kitFilesAt(k, placement.dir)
  const recorded = existing[kitName]?.files ?? {}
  for (const [path, contents] of files) {
    const current = existsSync(join(dir, path)) ? readFileSync(join(dir, path)) : null
    if (current && recorded[path] === undefined && !flags.force && !current.equals(contents)) {
      throw new UsageError(`${path} exists and is not chromokit's; move it aside or use --force`)
    }
  }
  const others = parts(dir, existing)
    .filter((p) => p.name !== kitName)
    .map((p) => plan(dir, p))
  refuseEdited(others, flags)

  const log = []
  apply(dir, others, flags, log)
  // A kit moved with --force leaves its old place.
  for (const path of Object.keys(recorded)) {
    if (!files.has(path) && existsSync(join(dir, path))) {
      if (!flags.dryRun) rmSync(join(dir, path))
      log.push(`removed  ${path}`)
    }
  }
  for (const [path, contents] of files) {
    if (!flags.dryRun) write(dir, path, contents)
    log.push(`kit      ${path}`)
  }
  const site = others.find((p) => !p.placement)
  if (!flags.dryRun) {
    writeManifest(dir, {
      target: site?.name,
      files: site?.files,
      kits: { ...kitsOf(others), [kitName]: { placement, files } },
    })
  }
  log.push(`manifest ${MANIFEST} (chromokit ${VERSION}, ${[site?.name, ...Object.keys(kitsOf(others)), kitName].filter(Boolean).join(', ')})`)
  return { log, next: k.next(placement), placement }
}

/** Replace the kit's files with this version's. Refuses files edited locally unless forced. */
export function sync(dir, flags = {}) {
  const manifest = readManifest(dir)
  if (!manifest) throw new UsageError(`no ${MANIFEST} in ${dir}: run \`chromokit init <target>\` first`)
  const plans = parts(dir, manifest).map((p) => plan(dir, p))
  refuseEdited(plans, flags)
  const log = []
  const changed = apply(dir, plans, flags, log)
  const site = plans.find((p) => !p.placement)
  if (!flags.dryRun) writeManifest(dir, { target: site?.name, files: site?.files, kits: kitsOf(plans) })
  log.push(`chromokit ${manifest.version} → ${VERSION}: ${changed} file${changed === 1 ? '' : 's'} updated`)
  return { log }
}

/** Is every kit file present and as chromokit wrote it? */
export function check(dir) {
  const manifest = readManifest(dir)
  if (!manifest) throw new UsageError(`no ${MANIFEST} in ${dir}`)
  const recorded = { ...(manifest.files ?? {}) }
  const names = manifest.target ? [manifest.target] : []
  for (const name of Object.keys(KITS)) {
    if (!manifest[name]?.files) continue
    Object.assign(recorded, manifest[name].files)
    names.push(name)
  }
  const problems = []
  for (const [path, hash] of Object.entries(recorded)) {
    const absolute = join(dir, path)
    if (!existsSync(absolute)) problems.push(`missing  ${path}`)
    else if (sha(readFileSync(absolute)) !== hash) problems.push(`edited   ${path}`)
  }
  return { ok: problems.length === 0, problems, manifest, names, count: Object.keys(recorded).length }
}

// ------------------------------------------------------------------ the command

const HELP = `chromokit ${VERSION} — a shared UI kit: tokens, components and starter sites.

Usage:
  chromokit init <target> [dir]   write a starter site for <target> into dir (default: .)
      --name <name>               the project's name (default: the folder's)
      --description <text>        one line about it
      --repo <owner/name>         its GitHub repository (default: from git remote origin)
      --url <url>                 where the site is published (default: GitHub Pages)
      --author <name>             who wrote it
      --accent <light>[,<dark>]   the project's own accent colour(s), over chromokit's blue
      --mark-style <style>        the logo mark: ${Object.keys(MARK_STYLES).join(', ')} (default: genomes)
      --no-mark                   do not draw a logo mark
      --force                     overwrite existing files
      --dry-run                   say what would be written, write nothing
  chromokit add <kit> [dir]       add a kit beside the site; \`report\`: a Python package's report
      --package <name>            the import package that gets src/<name>/_report/ (default: the only one)
      --force                     overwrite existing files
      --dry-run                   say what would be written, write nothing
  chromokit sync [dir]            replace the kit's files with this version's (--force to overwrite local edits)
  chromokit check [dir]           exit 1 if a kit file was edited or removed
  chromokit mark [--name <name>] [--style <style>] [--cells <n>] [--out <file>]
  chromokit targets               list the targets
  chromokit kits                  list the kits \`add\` takes
  chromokit version

Run it without installing anything:  npx github:js2264/chromokit init <target>`

function parse(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const [key, inline] = arg.slice(2).split('=', 2)
    const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    if (['force', 'dryRun', 'help', 'version'].includes(camel)) flags[camel] = true
    else if (camel === 'noMark') flags.mark = false
    else {
      const value = inline ?? argv[++i]
      if (value === undefined) throw new UsageError(`--${key} needs a value`)
      flags[camel] = value
    }
  }
  return { positional, flags }
}

export function main(argv, out = console.log, err = console.error) {
  try {
    const { positional, flags } = parse(argv)
    const [command, ...rest] = positional
    if (flags.version || command === 'version') {
      out(VERSION)
      return 0
    }
    if (flags.help || command === undefined || command === 'help') {
      out(HELP)
      return 0
    }
    switch (command) {
      case 'targets':
        for (const t of targets()) out(`${t.name.padEnd(10)} ${t.description}`)
        return 0
      case 'kits':
        for (const [name, k] of Object.entries(KITS)) out(`${name.padEnd(10)} ${k.description}`)
        return 0
      case 'add': {
        const [name, dir = '.'] = rest
        if (!name) throw new UsageError(`add needs a kit: chromokit add <kit> [dir], one of: ${Object.keys(KITS).join(', ')}`)
        const { log, next } = add(name, resolve(dir), flags)
        for (const line of log) out(line)
        if (next.length > 0 && !flags.dryRun) {
          out('\nNext:')
          for (const step of next) out(`  ${step}`)
        }
        return 0
      }
      case 'init': {
        const [name, dir = '.'] = rest
        if (!name) throw new UsageError('init needs a target: chromokit init <target> [dir]')
        const { log, next } = init(name, resolve(dir), flags)
        for (const line of log) out(line)
        if (next.length > 0 && !flags.dryRun) {
          out('\nNext:')
          if (resolve(dir) !== process.cwd()) out(`  cd ${dir}`)
          for (const step of next) out(`  ${step}`)
        }
        return 0
      }
      case 'sync': {
        const { log } = sync(resolve(rest[0] ?? '.'), flags)
        for (const line of log) out(line)
        return 0
      }
      case 'check': {
        const { ok, problems, manifest, names, count } = check(resolve(rest[0] ?? '.'))
        if (ok) {
          out(`chromokit ${manifest.version} (${names.join(', ')}): all ${count} kit files as written`)
          if (manifest.version !== VERSION) out(`(this is chromokit ${VERSION}: \`chromokit sync\` would update them)`)
          return 0
        }
        for (const line of problems) err(line)
        err(
          '\nKit files are replaced on sync: put local changes in your own files (your stylesheet, your report template), then restore these with `chromokit sync --force`.',
        )
        return 1
      }
      case 'mark': {
        const svg = markSvg({ name: flags.name ?? 'chromokit', style: flags.style ?? 'genomes', cells: Number(flags.cells ?? 7) })
        if (flags.out) {
          mkdirSync(dirname(resolve(flags.out)), { recursive: true })
          writeFileSync(resolve(flags.out), svg)
          out(`wrote ${flags.out}`)
        } else out(svg)
        return 0
      }
      default:
        throw new UsageError(`unknown command "${command}"\n\n${HELP}`)
    }
  } catch (error) {
    if (error instanceof UsageError) {
      err(`chromokit: ${error.message}`)
      return 2
    }
    throw error
  }
}
