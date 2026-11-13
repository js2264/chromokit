// Nothing on screen under 11 px (chromomap's rule 6), in every stylesheet the
// kit ships: a size in px, in rem at a 16px root, or in `calc(n * var(--cx-rem))`,
// which every host keeps at 16px.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname
const FLOOR = 11

function sheets(dir) {
  const out = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(dir, name)
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...sheets(path))
    else if (/\.(css|scss)$/.test(name)) out.push(path)
  }
  return out
}

function px(value) {
  let m = /^calc\(\s*([\d.]+)\s*\*\s*var\(--cx-rem\)\s*\)$/.exec(value)
  if (m) return Number(m[1]) * 16
  m = /^([\d.]+)px$/.exec(value)
  if (m) return Number(m[1])
  m = /^([\d.]+)rem$/.exec(value)
  if (m) return Number(m[1]) * 16
  return null
}

test(`no font size under ${FLOOR}px`, () => {
  const tokens = readFileSync(join(ROOT, 'dist', 'css', 'tokens.css'), 'utf8')
  const vars = Object.fromEntries([...tokens.matchAll(/(--cx-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
  const small = []
  for (const path of [...sheets('dist'), ...sheets('_extensions/chromokit')]) {
    const css = readFileSync(join(ROOT, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of css.matchAll(/font(?:-size)?\s*:\s*([^;}]+)[;}]/g)) {
      let value = m[1].trim()
      // `font: 600 <size> / <line> family` → the size; `font-size: <size>`.
      const shorthand = /^(?:(?:italic|normal|[1-9]00|bold)\s+)*(var\([^)]+\)|calc\([^)]*\)\)?|[\d.]+(?:px|rem))/.exec(value)
      if (shorthand) value = shorthand[1]
      const ref = /^var\((--cx-[a-z0-9-]+)\)$/.exec(value)
      if (ref) value = vars[ref[1]] ?? value
      const size = px(value)
      if (size !== null && size < FLOOR - 0.01) small.push(`${path}: ${m[0].trim()} (${size.toFixed(1)}px)`)
    }
  }
  assert.deepEqual(small, [])
})
