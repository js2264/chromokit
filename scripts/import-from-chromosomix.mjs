#!/usr/bin/env node
/**
 * Re-snapshot chromokit's tokens from a chromosomix checkout.
 *
 *     node scripts/import-from-chromosomix.mjs <path-to-chromosomix> [--commit <sha>]
 *
 * Reads `<path>/src/ui/styles.css` and rewrites `tokens/chromosomix.json`.
 * Run `npm run build` afterwards and review the diff: this is how chromokit
 * deliberately takes up a newer look of the app. It never writes to the
 * chromosomix checkout.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readChromosomixTokens } from './lib/chromosomix.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

const args = process.argv.slice(2)
const source = args.find((arg) => !arg.startsWith('--'))
if (source === undefined) {
  console.error('usage: node scripts/import-from-chromosomix.mjs <path-to-chromosomix> [--commit <sha>]')
  process.exit(2)
}
const commitFlag = args.indexOf('--commit')
let commit = commitFlag >= 0 ? args[commitFlag + 1] : null
if (commit === null) {
  try {
    commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    commit = 'unknown'
  }
}

const css = readFileSync(join(source, 'src', 'ui', 'styles.css'), 'utf8')
const tokens = readChromosomixTokens(css)
const out = {
  $comment:
    'Snapshot of chromosomix\'s design tokens. Written by scripts/import-from-chromosomix.mjs; do not edit by hand.',
  source: {
    repository: 'https://github.com/js2264/chromosomix',
    path: 'src/ui/styles.css',
    commit,
  },
  ...tokens,
}
const target = join(ROOT, 'tokens', 'chromosomix.json')
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`)
console.log(`wrote ${target} from ${commit}`)
