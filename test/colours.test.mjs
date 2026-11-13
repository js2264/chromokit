// The family, state and series colours held to chromomap's thresholds
// (docs/ui.md §4.2, D15), in both palettes, with lib/colour.mjs (a port of
// chromomap's scripts/port-colours.mjs).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { checkPalette, contrast, deltaE, THRESHOLDS, VISIONS } from '../lib/colour.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const tokens = JSON.parse(readFileSync(join(ROOT, 'dist', 'tokens', 'tokens.json'), 'utf8'))
const SURFACES = ['bg', 'bg-sunken', 'bg-raised', 'bg-muted', 'accent-soft']
const STATES = ['done', 'cached', 'stale', 'failed', 'queued', 'never', 'bypassed', 'running']

const pick = (palette, prefix) =>
  Object.fromEntries(Object.entries(palette).filter(([name]) => name.startsWith(prefix)).map(([name, v]) => [name.slice(prefix.length), v]))

for (const mode of ['light', 'dark']) {
  const p = tokens[mode]
  const surfaces = Object.fromEntries(SURFACES.map((name) => [name, p[name]]))
  const states = Object.fromEntries(STATES.map((name) => [name, p[`state-${name}`]]))
  const families = pick(p, 'family-')

  test(`${mode}: ten families, each 3:1 on every surface, apart from each other and from every state and the accent`, () => {
    assert.equal(Object.keys(families).length, 10)
    const findings = checkPalette({
      colours: { ...families, any: p.text },
      surfaces,
      apart: { ...states, accent: p.accent },
    })
    // `any` is the text colour: it is held to the pairs and the surfaces, not to the states (queued is a text grey too).
    assert.deepEqual(findings.filter((f) => !f.startsWith('any~')), [])
  })

  test(`${mode}: running is a colour of its own, 3:1 on every surface, apart from the accent and every other state`, () => {
    const running = p['state-running']
    assert.notEqual(running, p.accent)
    for (const surface of SURFACES) assert.ok(contrast(running, p[surface]) >= THRESHOLDS.contrast, surface)
    for (const [name, colour] of Object.entries({ ...states, accent: p.accent })) {
      if (name === 'running') continue
      assert.ok(deltaE(running, colour) >= THRESHOLDS.deltaEState, `running~${name}`)
      for (const vision of VISIONS.slice(1)) assert.ok(deltaE(running, colour, vision) >= THRESHOLDS.deltaESimulated, `running~${name} ${vision}`)
    }
  })

  test(`${mode}: the plot series are told apart under every vision and stand off the page`, () => {
    const series = Object.fromEntries(tokens.series[mode].map((c, i) => [`series-${i + 1}`, c]))
    assert.equal(tokens.series[mode][0], p.accent)
    const findings = checkPalette({ colours: series, surfaces: { bg: p.bg, 'bg-raised': p['bg-raised'], 'bg-sunken': p['bg-sunken'] } })
    assert.deepEqual(findings, [])
  })
}
