/**
 * Reading chromosomix's design tokens out of its stylesheet.
 *
 * chromosomix (https://github.com/js2264/chromosomix) declares its look in
 * `src/ui/styles.css`, unprefixed: a light palette on a selector list that
 * includes `:root[data-theme='light']`, a dark one on `:root[data-theme='dark']`
 * (and again inside a `prefers-color-scheme` query), and the type and shape on
 * a plain `:root` block. chromokit snapshots those values into
 * `tokens/chromosomix.json`; this module is the one place that knows how to
 * find them, and is shared by the importer and the drift check.
 *
 * It only ever *reads* chromosomix. Nothing here writes to that repository.
 */

/** The colour tokens of each palette, in the order the stylesheet gives them. */
export const COLOUR_TOKENS = [
  'bg',
  'bg-sunken',
  'bg-raised',
  'bg-muted',
  'border',
  'border-strong',
  'text',
  'text-dim',
  'text-faint',
  'accent',
  'accent-soft',
  'on-accent',
  'danger',
  'danger-soft',
  'ok',
  'warn',
  'warn-soft',
  'tab-rest',
]

/** The elevations, which differ between the two palettes. */
export const SHADOW_TOKENS = ['shadow-1', 'shadow-2', 'shadow-up']

/** Type and shape, from the plain `:root` block. */
export const BASE_TOKENS = ['sans', 'mono', 'radius', 'step--2', 'step--1', 'step-0', 'step-1', 'step-2', 'step-3']

/** The custom properties one rule declares, by name without the dashes. */
function declarations(body) {
  const out = {}
  for (const match of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[match[1]] = match[2].replace(/\s+/g, ' ').trim()
  }
  return out
}

/** Every flat rule of the sheet, comments removed, at-rule wrappers ignored. */
function rules(css) {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1]
      .split(',')
      .map((selector) => selector.trim().replace(/"/g, "'"))
      .filter(Boolean),
    tokens: declarations(match[2]),
  }))
}

function pick(tokens, names, where, missing) {
  const out = {}
  for (const name of names) {
    if (name in tokens) out[name] = tokens[name]
    else missing.push(`--${name} (${where})`)
  }
  return out
}

/**
 * The palettes, type and shape of a chromosomix stylesheet.
 *
 * Throws, naming every token it could not find, rather than returning a
 * partial set: a token that silently went missing would become a colour that
 * silently stopped matching.
 */
export function readChromosomixTokens(css) {
  const all = rules(css)
  const light = all.find((rule) => rule.selectors.includes(":root[data-theme='light']") && 'bg' in rule.tokens)
  const dark = all.find(
    (rule) => rule.selectors.length === 1 && rule.selectors[0] === ":root[data-theme='dark']" && 'bg' in rule.tokens,
  )
  const base = all.find((rule) => rule.selectors.length === 1 && rule.selectors[0] === ':root' && 'sans' in rule.tokens)
  const missing = []
  if (light === undefined) missing.push('the light palette')
  if (dark === undefined) missing.push('the dark palette')
  if (base === undefined) missing.push('the :root block with --sans')
  if (missing.length > 0) throw new Error(`chromosomix's stylesheet no longer declares ${missing.join(', ')}`)

  const result = {
    color: {
      light: pick(light.tokens, COLOUR_TOKENS, 'light', missing),
      dark: pick(dark.tokens, COLOUR_TOKENS, 'dark', missing),
    },
    shadow: {
      light: pick(light.tokens, SHADOW_TOKENS, 'light', missing),
      dark: pick(dark.tokens, SHADOW_TOKENS, 'dark', missing),
    },
    base: pick(base.tokens, BASE_TOKENS, ':root', missing),
  }
  if (missing.length > 0) throw new Error(`chromosomix's stylesheet no longer declares ${missing.join(', ')}`)
  return result
}

/**
 * The differences between two token sets, as `group.mode.name: was → now`
 * lines. Empty when they agree.
 */
export function diffTokens(snapshot, current) {
  const lines = []
  const walk = (a, b, path) => {
    const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])
    for (const key of keys) {
      const left = a?.[key]
      const right = b?.[key]
      const here = path === '' ? key : `${path}.${key}`
      if (typeof left === 'object' || typeof right === 'object') walk(left, right, here)
      else if (left !== right) lines.push(`${here}: ${left ?? '(absent)'} → ${right ?? '(absent)'}`)
    }
  }
  walk(
    { color: snapshot.color, shadow: snapshot.shadow, base: snapshot.base },
    { color: current.color, shadow: current.shadow, base: current.base },
    '',
  )
  return lines
}
