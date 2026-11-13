/**
 * chromokit's command line: put the kit into a repository, keep it up to date,
 * and check that nobody edited the copied files.
 *
 *   chromokit init <target> [dir]   a starter site for <target>, with the kit's files
 *   chromokit sync [dir]            replace the kit's files with this version's
 *   chromokit check [dir]           exit 1 if a kit file was edited or removed
 *   chromokit mark                  draw a logo mark
 *   chromokit targets               list the targets
 *
 * Two kinds of file are written. *Starter* files (a config, a home page, the
 * site's own stylesheet) are the project's from the moment they exist: init
 * writes them once, with the project's name filled in, and never again. *Kit*
 * files (stylesheets, templates, scripts) stay chromokit's: their hashes go in
 * `chromokit.json`, `sync` replaces them, and `check` refuses a local edit —
 * a local change belongs in the starter stylesheet, which loads after them.
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

function writeManifest(dir, t, files) {
  const manifest = {
    $comment:
      'Written by chromokit (https://github.com/js2264/chromokit). The files listed are the kit\'s: `npx github:js2264/chromokit sync` replaces them and `… check` refuses local edits. Put local changes in your own stylesheet instead.',
    version: VERSION,
    target: t.name,
    files: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, contents]) => [path, sha(contents)])),
  }
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

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
  if (existing && existing.target !== t.name && !flags.force) {
    throw new UsageError(`${dir} already has chromokit for "${existing.target}"; use --force to add "${t.name}" over it`)
  }
  mkdirSync(dir, { recursive: true })

  for (const [path, contents] of starterFiles(t, values)) {
    if (existsSync(join(dir, path)) && !flags.force) {
      log.push(`kept     ${path} (yours already)`)
      continue
    }
    if (!flags.dryRun) write(dir, path, contents)
    log.push(`starter  ${path}`)
  }

  const kit = kitFiles(t)
  for (const [path, contents] of kit) {
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

  if (!flags.dryRun) writeManifest(dir, t, kit)
  log.push(`manifest ${MANIFEST} (chromokit ${VERSION}, ${t.name})`)
  return { log, next: t.next ?? [], values }
}

/** Replace the kit's files with this version's. Refuses files edited locally unless forced. */
export function sync(dir, flags = {}) {
  const manifest = readManifest(dir)
  if (!manifest) throw new UsageError(`no ${MANIFEST} in ${dir}: run \`chromokit init <target>\` first`)
  const t = target(manifest.target)
  const kit = kitFiles(t)
  const log = []
  const edited = []
  for (const [path, recorded] of Object.entries(manifest.files)) {
    const absolute = join(dir, path)
    if (existsSync(absolute) && sha(readFileSync(absolute)) !== recorded) edited.push(path)
  }
  if (edited.length > 0 && !flags.force) {
    throw new UsageError(
      `these kit files were edited locally:\n  ${edited.join('\n  ')}\nmove the change into your own stylesheet, or run sync --force to overwrite`,
    )
  }
  for (const path of Object.keys(manifest.files)) {
    if (!kit.has(path) && existsSync(join(dir, path))) {
      if (!flags.dryRun) rmSync(join(dir, path))
      log.push(`removed  ${path}`)
    }
  }
  let changed = 0
  for (const [path, contents] of kit) {
    const absolute = join(dir, path)
    const same = existsSync(absolute) && readFileSync(absolute).equals(contents)
    if (!same) {
      if (!flags.dryRun) write(dir, path, contents)
      changed += 1
      log.push(`updated  ${path}`)
    }
  }
  if (!flags.dryRun) writeManifest(dir, t, kit)
  log.push(`chromokit ${manifest.version} → ${VERSION}: ${changed} file${changed === 1 ? '' : 's'} updated`)
  return { log }
}

/** Is every kit file present and as chromokit wrote it? */
export function check(dir) {
  const manifest = readManifest(dir)
  if (!manifest) throw new UsageError(`no ${MANIFEST} in ${dir}`)
  const problems = []
  for (const [path, recorded] of Object.entries(manifest.files)) {
    const absolute = join(dir, path)
    if (!existsSync(absolute)) problems.push(`missing  ${path}`)
    else if (sha(readFileSync(absolute)) !== recorded) problems.push(`edited   ${path}`)
  }
  return { ok: problems.length === 0, problems, manifest }
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
  chromokit sync [dir]            replace the kit's files with this version's (--force to overwrite local edits)
  chromokit check [dir]           exit 1 if a kit file was edited or removed
  chromokit mark [--name <name>] [--style <style>] [--cells <n>] [--out <file>]
  chromokit targets               list the targets
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
        const { ok, problems, manifest } = check(resolve(rest[0] ?? '.'))
        if (ok) {
          out(`chromokit ${manifest.version} (${manifest.target}): all ${Object.keys(manifest.files).length} kit files as written`)
          if (manifest.version !== VERSION) out(`(this is chromokit ${VERSION}: \`chromokit sync\` would update them)`)
          return 0
        }
        for (const line of problems) err(line)
        err('\nKit files are replaced on sync: put local changes in your own stylesheet, then restore these with `chromokit sync --force`.')
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
