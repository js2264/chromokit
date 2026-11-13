/**
 * Colour science for holding a palette to thresholds: WCAG contrast, CIE Lab
 * (D65) and ΔE 1976, and simulated colour-vision deficiency.
 *
 * Ported from chromomap's scripts/port-colours.mjs (js2264/chromomap@2b5dfe5,
 * MIT, same author), which chose the family colours with it: the same sRGB
 * linearisation, WCAG contrast, CIE Lab (D65), ΔE 1976, and Machado, Oliveira
 * and Fernandes (2009) simulation matrices at severity 1.0 applied in linear
 * RGB. Adapted: the planning palette, the report and the command line are left
 * out; `checkPalette` takes any named colours rather than ports.
 */

/** chromomap's thresholds (docs/ui.md §4.2, D15): contrast ≥ 3:1; ΔE ≥ 12 apart (≥ 8 under each simulation); ΔE ≥ 15 from the state colours. */
export const THRESHOLDS = Object.freeze({
  contrast: 3,
  deltaE: 12,
  deltaESimulated: 8,
  deltaEState: 15,
})

/** Machado 2009, severity 1.0, for linear RGB. */
export const SIMULATIONS = Object.freeze({
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
})

export const VISIONS = Object.freeze(['normal', ...Object.keys(SIMULATIONS)])

/** `#rgb`, `#rrggbb`(`aa`), `rgb(…)` or an `[r, g, b]` array as `[r, g, b]` (0–255). */
export function parseColour(value) {
  if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map(Number)
  const text = String(value).trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(text)
  if (m !== null) return [...m[1]].map((c) => parseInt(c + c, 16))
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(text)
  if (m !== null) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text)
  if (m !== null) return [Number(m[1]), Number(m[2]), Number(m[3])]
  throw new Error(`not a colour: ${String(value)}`)
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linear = (rgb) => rgb.map((v) => lin(v / 255))

function luminance(rgb) {
  const [r, g, b] = linear(rgb)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio of two colours. */
export function contrast(a, b) {
  const [x, y] = [luminance(parseColour(a)), luminance(parseColour(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

function labOfLinear([r, g, b]) {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}

/** CIE Lab of a colour, as seen with normal vision or under one of `SIMULATIONS`. */
export function lab(colour, vision = 'normal') {
  const v = linear(parseColour(colour))
  if (vision === 'normal') return labOfLinear(v)
  const m = SIMULATIONS[vision]
  if (m === undefined) throw new Error(`unknown vision ${vision}`)
  return labOfLinear(m.map((row) => Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))))
}

/** ΔE 1976 between two colours under one vision. */
export function deltaE(a, b, vision = 'normal') {
  const [p, q] = [lab(a, vision), lab(b, vision)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

const round = (x, digits = 1) => Math.round(x * 10 ** digits) / 10 ** digits

/**
 * Every threshold for one palette: `colours`, `surfaces` and `apart` (colours
 * it must stay ΔE `deltaEState` from, such as the states) each map a name to a
 * colour. Returns what falls short, one line each; empty when all is met.
 */
export function checkPalette({ colours, surfaces = {}, apart = {} }, thresholds = THRESHOLDS) {
  const findings = []
  const names = Object.keys(colours)
  for (const [surface, background] of Object.entries(surfaces)) {
    for (const name of names) {
      const ratio = contrast(colours[name], background)
      if (ratio < thresholds.contrast) findings.push(`${name} on ${surface}: contrast ${round(ratio, 2)} < ${thresholds.contrast}`)
    }
  }
  for (const vision of VISIONS) {
    const floor = vision === 'normal' ? thresholds.deltaE : thresholds.deltaESimulated
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const d = deltaE(colours[names[i]], colours[names[j]], vision)
        if (d < floor) findings.push(`${names[i]}/${names[j]} (${vision}): ΔE ${round(d)} < ${floor}`)
      }
    }
  }
  for (const name of names) {
    for (const [other, colour] of Object.entries(apart)) {
      const d = deltaE(colours[name], colour)
      if (d < thresholds.deltaEState) findings.push(`${name}~${other}: ΔE ${round(d)} < ${thresholds.deltaEState}`)
    }
  }
  return findings
}
