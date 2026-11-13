#!/usr/bin/env node
/**
 * Set chromokit's version everywhere it is written, then rebuild.
 *
 *     node scripts/version.mjs 0.2.0
 *
 * package.json and r/DESCRIPTION by hand here; the Quarto extension, the
 * file headers and the R package's tokens by the build. Then add a
 * `## [0.2.0]` section to CHANGELOG.md, commit, and push the tag v0.2.0:
 * .github/workflows/release.yml checks all of them agree.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const version = process.argv[2]
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error('usage: node scripts/version.mjs <major.minor.patch>')
  process.exit(2)
}
const pkgPath = join(ROOT, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.version = version
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
const lockPath = join(ROOT, 'package-lock.json')
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
lock.version = version
if (lock.packages?.['']) lock.packages[''].version = version
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
const descPath = join(ROOT, 'r', 'DESCRIPTION')
writeFileSync(descPath, readFileSync(descPath, 'utf8').replace(/^Version: .*$/m, `Version: ${version}`))
execFileSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' })
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8')
if (!changelog.includes(`## [${version}]`)) console.log(`\nNow add a "## [${version}]" section to CHANGELOG.md.`)
