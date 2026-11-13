# Changelog

All notable changes to chromokit. Versions follow [semver](https://semver.org):
a changed token value is a minor release; a renamed or removed `.cx-*` class,
token or kit file is a major one.

## [Unreleased]

### Added

- **Sphinx**, a seventh kind of site:
  - `chromokit init sphinx` writes a Sphinx site on the Furo theme, with MyST
    Markdown pages;
  - `docs/_static/chromokit.css` maps Furo's variables to the tokens;
  - a sidebar brand shows the mark, name, kicker and release;
  - the CI builds the starter (with warnings as errors) and screenshots it.
- **From chromomap:**
  - `--cx-family-*`: one colour for each kind of genomics data, with
    `[data-family]`, `.cx-dot`, `.cx-dot--many` and `.cx-family`.
  - `--cx-state-*`: one colour for each state of a job, with a running violet
    of its own, `[data-state]`, `.cx-ring` and `.cx-state`.
  - `.cx-num`, `.cx-focus-ring` and a focusable `.cx-splitter`.
  - `dist/js/format.mjs`: one formatter, with numbers joined to their units by
    a no-break space and input read with `.` or `,` as the decimal separator.
  - `lib/colour.mjs`: chromomap's colour science (WCAG contrast, ΔE, Machado
    colour-blindness simulation).
- **Tests:**
  - `test/colours.test.mjs` holds the families, the states and the plot series
    to chromomap's thresholds;
  - `test/sizes.test.mjs` fails on any font size under 11 px;
  - `test/format.test.mjs` runs chromomap's cases against the formatter.

### Changed

- **The plot series:**
  - They are now the accent plus six family colours (seven in all, was six).
  - The old set failed under simulated protanopia.
  - The matplotlib, ECharts, Plotly and ggplot2 themes follow them.
- **The smallest text is 11 px** (was 10.9 px): the kicker, the table headers
  and the sidebar groups, in every adapter.
- **`data-theme` on `<body>`** now switches the palette too, as Furo writes it.
- **`keys.js`** also follows Furo's `a.prev-page` and `a.next-page`.

## [0.1.0] - 2026-11-13

First release: chromosomix's look, for six kinds of site.

### Added

- **Tokens** snapshotted from chromosomix's `src/ui/styles.css` (70e566a): both
  palettes, shadows, type scale, radius and fonts. The syntax colours are
  Vitesse's, as metacooler's docs use them. The page measures are chromokit's
  own. They are available as CSS custom properties (`--cx-*`, declared on every
  host's light/dark switch), Sass, JSON/ESM and brand.yml.
- **Core components** (`.cx-*`):
  - controls and calls to action;
  - fields, the search well and keys;
  - kickers, chips, counts and badges;
  - cards, tiles, collapsible panels, key–value lists, facts and the drop zone;
  - the landing masthead, tagline and actions;
  - callouts, tables and framed code with a terminal bar;
  - the header, previous/next cards and the build line;
  - the status bar, tabs, the segmented control, toasts and progress bars;
  - `.cx-paper` and `.cx-dark` scopes.
- **A standalone page layout** (`chromokit-page.css`): a header, a sidebar
  (a drawer on narrow screens), prose and "On this page".
- **Behaviours:**
  - `theme.js`: light, dark or system, with no flash;
  - `keys.js`: ← and → turn the page, Ctrl+K and / open search;
  - `behaviours.js`: copy buttons, heading anchors, tabs and the contents
    highlight.
- **Adapters and starters:**
  - plain HTML;
  - Hugo (a theme, shortcodes, Chroma colours);
  - Zensical (metacooler's header and footer, generalised);
  - Astro Starlight (doc.chromosomix.app's look as a plugin over Rapide);
  - pkgdown (the kit compiled into Bootstrap by `pkgdown/extra.scss`);
  - Quarto (an extension with `chromokit-html` and `chromokit-revealjs`).
- **The R package** (`r/`): a pkgdown template package, plus
  `theme_chromokit()`, `scale_colour_chromokit()`, `scale_fill_chromokit()`,
  `chromokit_colours()` and `chromokit_palette()`.
- **Plot themes:** matplotlib styles, ECharts themes and Plotly templates,
  light and dark.
- **Logo marks:** a generator that draws a small contact map from a project's
  name, in three styles.
- **The command line:** `init`, `sync`, `check`, `mark` and `targets`. It runs
  from GitHub with `npx github:js2264/chromokit`.
- **Workflows:**
  - CI;
  - every starter built with its own tool and screenshotted, light and dark;
  - Pages;
  - releases with starter zips, and npm;
  - a weekly drift check against chromosomix.
