/**
 * Where each framework says "light" and "dark".
 *
 * chromokit's tokens are custom properties, so one stylesheet can serve every
 * host as long as the palettes are declared on whichever attribute or class
 * that host flips. These lists are the whole of that knowledge:
 *
 *   plain HTML, Hugo, an app, Starlight   <html data-theme="light|dark">
 *   Zensical / Material for MkDocs        <body data-md-color-scheme="default|slate">
 *   pkgdown, Bootstrap 5.3                <html data-bs-theme="light|dark">
 *   Quarto                                <body class="quarto-light|quarto-dark">
 *   any subtree                           class="cx-light" | "cx-dark" | "cx-paper"
 *
 * With no attribute at all, the system's preference decides.
 * `.cx-paper` is light whatever is around it: for a figure that will be
 * exported, or a screenshot of a light app on a dark page.
 *
 * `data-theme` and `data-bs-theme` count on <html> only: Bootstrap also puts
 * `data-bs-theme` on single components (Quarto's navbar carries "dark" in
 * every palette), and those must not flip the kit's tokens.
 */

export const LIGHT_SELECTORS = [
  ':root',
  '::backdrop',
  '.cx-light',
  '.cx-paper',
  ":root[data-theme='light']",
  "[data-md-color-scheme='default']",
  ":root[data-bs-theme='light']",
  'body.quarto-light',
]

export const DARK_SELECTORS = [
  ":root[data-theme='dark']",
  ":root[data-theme='dark'] ::backdrop",
  '.cx-dark',
  "[data-md-color-scheme='slate']",
  ":root[data-bs-theme='dark']",
  'body.quarto-dark',
]

/** Dark by the system's preference, unless the page has said light. */
export const MEDIA_DARK_SELECTORS = [
  ":root:not([data-theme='light']):not([data-bs-theme='light'])",
  ":root:not([data-theme='light']):not([data-bs-theme='light']) ::backdrop",
]

/** Light again, after the dark rules, so a light scope nested in a dark one wins. */
export const LIGHT_SCOPE_SELECTORS = ['.cx-light', '.cx-paper']

const block = (selectors, body, indent = '') =>
  `${indent}${selectors.join(`,\n${indent}`)} {\n${body
    .split('\n')
    .map((line) => (line === '' ? line : `${indent}${line}`))
    .join('\n')}\n${indent}}`

/**
 * One set of declarations per palette, placed on every selector that means
 * that palette. `light` and `dark` are strings of declarations, one per line,
 * already indented by two spaces.
 */
export function paletteCss(light, dark) {
  return [
    block(LIGHT_SELECTORS, `  color-scheme: light;\n${light}`),
    '',
    '@media (prefers-color-scheme: dark) {',
    block(MEDIA_DARK_SELECTORS, `  color-scheme: dark;\n${dark}`, '  '),
    '}',
    '',
    block(DARK_SELECTORS, `  color-scheme: dark;\n${dark}`),
    '',
    block(LIGHT_SCOPE_SELECTORS, `  color-scheme: light;\n${light}`),
  ].join('\n')
}

/**
 * A project's own accent, over chromokit's blue: the light and dark values,
 * and the soft fill each derives. Written by `chromokit init --accent` into
 * the project's own stylesheet.
 */
export function accentCss(light, dark = light) {
  const decl = (accent, bg) =>
    [
      `  --cx-accent: ${accent};`,
      `  --cx-accent-soft: color-mix(in srgb, ${accent} 16%, ${bg});`,
    ].join('\n')
  return paletteCss(decl(light, '#ffffff'), decl(dark, '#191a1c'))
}
