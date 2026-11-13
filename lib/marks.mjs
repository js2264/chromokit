/**
 * Marks: a project's logo, drawn as a small Hi-C contact map on a dark plate.
 *
 * The family of chromosomix's "Field" mark and metacooler's genome grid: a
 * square of cells, strongest along the diagonal, in blocks (domains, or
 * genomes) that fall off with distance, with a few long-range contacts lit
 * off the diagonal. Symmetric, as a contact map is. The pattern comes from the
 * project's name, so every project gets its own mark and the same name always
 * gives the same one.
 *
 * Pure SVG and no dependencies, so the CLI can draw one anywhere Node runs.
 */

/** FNV-1a, for turning a name into a seed. */
function hash(text) {
  let h = 0x811c9dc5
  for (const char of String(text)) {
    h ^= char.codePointAt(0)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: small, seeded, good enough for a pattern. */
function random(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const MARK_STYLES = {
  /** chromosomix's: one warm colour, its strength the contact frequency. */
  ember: { cells: ['#ce5c30'], low: '#ce5c30' },
  /** metacooler's: a colour per block (genome), white between blocks. */
  genomes: { cells: ['#6ba4e8', '#6cc48f', '#e3a857', '#b98ad6'], low: '#ffffff' },
  /** The accent alone: blue on ink. */
  accent: { cells: ['#6ba4e8'], low: '#6ba4e8' },
}

const round = (value, digits = 2) => Number(value.toFixed(digits)).toString()

/**
 * The intensity of every cell, 0..1, as an n×n symmetric matrix, and the block
 * each index belongs to.
 */
export function contactPattern({ name = 'chromokit', cells = 7, seed } = {}) {
  const n = Math.max(4, Math.min(16, Math.round(cells)))
  const rand = random(seed ?? hash(name))

  // Blocks: two to four, none narrower than two cells. Start every block at
  // two cells and deal the rest out at random, so any n gets a partition.
  const count = Math.max(2, Math.min(4, Math.floor(n / 2), 2 + Math.floor(rand() * 3)))
  const sizes = new Array(count).fill(2)
  for (let rest = n - 2 * count; rest > 0; rest--) sizes[Math.floor(rand() * count)] += 1
  const block = []
  sizes.forEach((size, b) => {
    for (let k = 0; k < size; k++) block.push(b)
  })

  const value = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const d = j - i
      const v =
        block[i] === block[j]
          ? Math.max(0.24, (1 + d) ** -1.25)
          : 0.15 * 2 ** (-(d - 1) / 2.4)
      value[i][j] = v
      value[j][i] = v
    }
  }
  // Long-range contacts: two or three, away from the diagonal.
  const accents = 2 + Math.floor(rand() * 2)
  for (let k = 0; k < accents; k++) {
    const i = Math.floor(rand() * n)
    const j = Math.floor(rand() * n)
    if (Math.abs(i - j) < 2) continue
    const v = 0.3 + rand() * 0.3
    value[i][j] = Math.max(value[i][j], v)
    value[j][i] = value[i][j]
  }
  return { n, block, value }
}

/**
 * The mark as an SVG document.
 *
 * Options: `name` (seeds the pattern), `cells` (4–16, default 7), `style`
 * ('ember' | 'genomes' | 'accent'), `colors` (overrides the style's cell
 * colours), `plate` and `edge` (the plate's fill and hairline).
 */
export function markSvg({
  name = 'chromokit',
  cells = 7,
  seed,
  style = 'genomes',
  colors,
  plate = '#17181a',
  edge = '#ffffff',
  edgeOpacity = 0.14,
  title,
} = {}) {
  const { n, block, value } = contactPattern({ name, cells, seed })
  const palette = MARK_STYLES[style] ?? MARK_STYLES.genomes
  const cellColours = colors && colors.length > 0 ? colors : palette.cells
  const low = palette.low

  const margin = 2.25
  const span = 32 - 2 * margin
  const gapFraction = 0.143
  const pitch = span / (n - gapFraction)
  const size = pitch * (1 - gapFraction)
  const radius = size * 0.2

  const rects = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = value[i][j]
      const same = block[i] === block[j]
      const colour = same ? cellColours[block[i] % cellColours.length] : low
      const opacity = same ? v : Math.min(0.6, Math.max(0.07, v))
      if (opacity < 0.06) continue
      rects.push(
        `<rect x="${round(margin + j * pitch)}" y="${round(margin + i * pitch)}" width="${round(size)}" height="${round(size)}" rx="${round(radius)}" fill="${colour}" fill-opacity="${round(opacity)}"/>`,
      )
    }
  }
  const label = title ?? name
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="${escapeXml(label)}">`,
    `<title>${escapeXml(label)}</title>`,
    `<rect x=".5" y=".5" width="31" height="31" rx="6.5" fill="${plate}" stroke="${edge}" stroke-opacity="${edgeOpacity}"/>`,
    ...rects,
    '</svg>',
    '',
  ].join('\n')
}

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
}
