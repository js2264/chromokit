import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { diffTokens, readChromosomixTokens } from '../scripts/lib/chromosomix.mjs'
import { accentCss, DARK_SELECTORS, LIGHT_SELECTORS } from '../lib/selectors.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const snapshot = JSON.parse(readFileSync(join(ROOT, 'tokens', 'chromosomix.json'), 'utf8'))

// A stylesheet laid out as chromosomix's is, from the snapshot itself.
function sheet(tokens) {
  const decl = (values) => Object.entries(values).map(([k, v]) => `  --${k}: ${v};`).join('\n')
  return [
    `:root, :root[data-theme='light'], .content { ${decl(tokens.color.light)}\n${decl(tokens.shadow.light)} }`,
    `:root { ${decl(tokens.base)} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ${decl(tokens.color.dark)} } }`,
    `:root[data-theme='dark'] { ${decl(tokens.color.dark)}\n${decl(tokens.shadow.dark)} }`,
  ].join('\n')
}

test('reads back the palettes a chromosomix-shaped stylesheet declares', () => {
  const read = readChromosomixTokens(sheet(snapshot))
  assert.deepEqual(diffTokens(snapshot, read), [])
})

test('names a token that changed', () => {
  const changed = structuredClone(snapshot)
  changed.color.dark.accent = '#000000'
  const lines = diffTokens(snapshot, readChromosomixTokens(sheet(changed)))
  assert.deepEqual(lines, [`color.dark.accent: ${snapshot.color.dark.accent} → #000000`])
})

test('refuses a stylesheet that lost a token, by name', () => {
  const broken = structuredClone(snapshot)
  delete broken.color.light['accent-soft']
  assert.throws(() => readChromosomixTokens(sheet(broken)), /--accent-soft \(light\)/)
})

test('an accent override covers every light and dark selector', () => {
  const css = accentCss('#7a3e9d', '#b98ad6')
  for (const selector of [...LIGHT_SELECTORS, ...DARK_SELECTORS]) assert.ok(css.includes(selector), selector)
  assert.ok(css.includes('--cx-accent: #7a3e9d;') && css.includes('--cx-accent: #b98ad6;'))
})
