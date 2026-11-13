#!/usr/bin/env node
/**
 * Has chromosomix's look moved on since chromokit's snapshot?
 *
 *     node scripts/drift.mjs <path-to-chromosomix-styles.css | path-to-chromosomix>
 *
 * Compares the tokens in chromosomix's current stylesheet with
 * `tokens/chromosomix.json` and prints every difference. Exits 0 when they
 * agree and 1 when they do not, so `.github/workflows/drift.yml` can report it.
 * Reading only: re-snapshotting is a deliberate `npm run import`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { diffTokens, readChromosomixTokens } from './lib/chromosomix.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const target = process.argv[2]
if (target === undefined) {
  console.error('usage: node scripts/drift.mjs <chromosomix checkout or its src/ui/styles.css>')
  process.exit(2)
}
const sheet = statSync(target).isDirectory() ? join(target, 'src', 'ui', 'styles.css') : target
if (!existsSync(sheet)) {
  console.error(`no stylesheet at ${sheet}`)
  process.exit(2)
}

const snapshot = JSON.parse(readFileSync(join(ROOT, 'tokens', 'chromosomix.json'), 'utf8'))
const current = readChromosomixTokens(readFileSync(sheet, 'utf8'))
const lines = diffTokens(snapshot, current)

if (lines.length === 0) {
  console.log(`No drift: chromosomix's tokens match the snapshot from ${snapshot.source.commit}.`)
  process.exit(0)
}
console.log(`chromosomix's tokens differ from chromokit's snapshot (${snapshot.source.commit}):\n`)
for (const line of lines) console.log(`- ${line}`)
console.log('\nTo take them up: npm run import -- <chromosomix checkout>, then npm run build.')
process.exit(1)
