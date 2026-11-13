# chromokit

**One look for every kind of site.** chromokit is the design tokens, components
and starter sites of [chromosomix](https://chromosomix.app), packaged for reuse
in:

- plain HTML pages
- Hugo sites
- [Zensical](https://zensical.org) or [Sphinx](https://www.sphinx-doc.org) (Furo) docs for Python packages
- [Astro Starlight](https://starlight.astro.build) sites
- pkgdown sites for R packages
- Quarto documents, websites, books and slides

It is the look of [doc.chromosomix.app](https://doc.chromosomix.app) and
[metacooler's documentation](https://jserizay.com/metacooler/): neutral greys,
one blue accent, colour used only for meaning, a dotted-grid page, solid
furniture with hairline borders, framed code with a terminal bar, light and dark.

**Gallery, tokens and live example sites:** <https://js2264.github.io/chromokit/>

## Start a site

```bash
npx github:js2264/chromokit init <target> [dir] --name hicool --repo js2264/hicool
```

| target      | what you get                                                                 | then                               |
|-------------|------------------------------------------------------------------------------|------------------------------------|
| `html`      | a landing page and a docs page, no build step                                | open `index.html`                  |
| `hugo`      | a Hugo theme in `themes/chromokit/`, with shortcodes                          | `hugo server`                      |
| `zensical`  | Zensical docs with metacooler's header and footer (works with Material for MkDocs too) | `uv run zensical serve`   |
| `sphinx`    | Sphinx docs on the Furo theme, MyST pages, the sidebar brand with kicker and release | `sphinx-build docs docs/_build/html` |
| `starlight` | doc.chromosomix.app's look as a Starlight plugin, over the Rapide theme      | `npm install && npm run dev`       |
| `pkgdown`   | an R package's pkgdown site, by copy (or use the [template package](#r))     | `pkgdown::build_site()`            |
| `quarto`    | a Quarto website with the `chromokit-html` format                            | `quarto preview`                   |

`init` writes two kinds of file, and records which is which in `chromokit.json`:

- **Starter files** are yours from the moment they are written: the config, a
  home page, and your own stylesheet. They are filled in with the project's name
  (read from `DESCRIPTION`, `pyproject.toml` or `package.json` when there is
  one), its repository (read from `git remote`) and its description. chromokit
  never touches them again.
- **Kit files** are chromokit's: stylesheets, templates and scripts. Their
  hashes are kept in `chromokit.json`. Leave them as they are and put local
  changes in your own stylesheet, which loads after them.

`init` also draws the project a **logo mark** from its name: a small contact map
on a dark plate, in the family of chromosomix's and metacooler's marks. It is
`--mark-style genomes` (the default), `ember` or `accent`, and `--no-mark` skips
it. `--accent "#7a3e9d,#b98ad6"` gives the project its own accent colour, light
then dark, over chromokit's blue.

### Keeping it up to date

```bash
npx github:js2264/chromokit#v0.2.0 sync    # replace the kit files with that version's
npx github:js2264/chromokit check          # exit 1 if a kit file was edited or removed
```

`sync` refuses to overwrite a kit file you edited unless you pass `--force`.
`check` is meant for a project's CI.

## Other ways in

- **Quarto:** run `quarto add js2264/chromokit` in any project, then use
  `format: chromokit-html` (or `chromokit-revealjs` for slides).
- **R (template package)** <a id="r"></a>: in `_pkgdown.yml`, set
  `template: package: chromokit`. In `DESCRIPTION`, add
  `Config/Needs/website: js2264/chromokit/r`. To install it locally, run
  `pak::pak("js2264/chromokit/r")`. The same package also provides
  `theme_chromokit()` and `scale_colour_chromokit()` for ggplot2. See
  [r/README.md](r/README.md), and the package's own site, built with its own
  template, at <https://js2264.github.io/chromokit/r/>.
- **A link:**
  `https://cdn.jsdelivr.net/gh/js2264/chromokit@v0.1.0/dist/css/chromokit.css`
  has the tokens and components. `…/dist/css/chromokit-page.css` adds the
  page layout.
- **npm:** run `npm install chromokit`, then `import 'chromokit/tokens.css'`.
  The tokens are also available as data from `chromokit/tokens`, and the
  Starlight plugin from `chromokit/starlight`.
- **The tokens alone:**
  - `dist/css/tokens.css` (custom properties)
  - `dist/scss/_tokens.scss` (Sass)
  - `dist/tokens/tokens.json`
  - `dist/brand/_brand.yml` (brand.yml, read by Quarto, Shiny and bslib)
- **Plots:** `dist/plots/` has matplotlib styles, ECharts themes and Plotly
  templates. For matplotlib, `plt.style.use()` accepts the jsDelivr URL.

## What is in it

```
tokens/            the values: chromosomix's palettes (snapshot), Vitesse syntax colours, page measures
src/css/           the core components (`.cx-*`, no element styles) and the standalone page layout
src/js/            theme.js (light/dark/system), keys.js (← → and Ctrl+K), behaviours.js (copy, tabs, contents)
adapters/<host>/   what each framework needs on top: zensical, sphinx, starlight, pkgdown, quarto, hugo
templates/<target>/ starter files (target.json says which kit files go where)
lib/               the command line, the mark generator, the light/dark selectors
dist/              generated: everything above, built per host (committed, so copies and CDN links need no build)
_extensions/chromokit/  generated: the Quarto extension
r/                 the R package; r/R/tokens.R and r/inst/pkgdown/ are generated
site/              chromokit's own site: the gallery, the tokens, getting started
```

All colours are `--cx-*` custom properties. One stylesheet works in every host
because each palette is declared on whichever switch that host flips:

| host | switch |
|---|---|
| HTML, Hugo, Starlight | `<html data-theme>` |
| Zensical | `<body data-md-color-scheme>` |
| Sphinx (Furo) | `<body data-theme>` |
| pkgdown | `<html data-bs-theme>` |
| Quarto | `<body class="quarto-dark">` |

With no switch set, the system's preference decides. `.cx-paper` and
`.cx-dark` scope a subtree to one palette.

## Data, state and numbers

Three things come from [chromomap](https://github.com/js2264/chromomap):

- **A colour for each kind of genomics data.**
  - The ten families are reads, alignments, genome, index, fragments, pairs,
    track, peaks, value and report. Each is a `--cx-family-*` token.
  - Set `data-family="reads"` on an element and its `--cx-family` follows.
  - `.cx-dot` draws a family's dot: `.cx-dot--many` is a diamond for a
    collection, and `any` is hollow.
- **A colour for each state of a job.**
  - The states are running, done, cached, stale, failed, queued, never and
    bypassed. Each is a `--cx-state-*` token.
  - Running has a violet of its own; the others read the palette's own colours.
  - `.cx-ring` draws a state's ring and `.cx-state` its chip. Both use
    `data-state` and are told apart by shape as well as colour.
- **One formatter for numbers.**
  - `dist/js/format.mjs` provides `fmt.bytes`, `fmt.bp`, `durationText`,
    `withUnit` and others. It joins a number to its unit with a no-break space.
  - `parseNumberInput` accepts `.` or `,` as the decimal separator. When a
    value could be read two ways, it says so.

Two rules come with them:

- **Each colour means one thing.** Tests hold the family colours, the state
  colours and the plot series to chromomap's thresholds:
  - at least 3:1 contrast on every surface;
  - at least ΔE 12 between any two colours, and at least 8 under simulated
    protanopia, deuteranopia and tritanopia (`test/colours.test.mjs`).
- **Nothing on screen is smaller than 11 px** (`test/sizes.test.mjs`).

The plot series, `--cx-series-*` (also used by the matplotlib, ECharts, Plotly
and ggplot2 themes), are the accent plus six of the family colours. Those six
are the subset that stays furthest apart under all four kinds of vision.

## Developing

```bash
npm install          # the icon packages the build reads
npm run build        # tokens + sources → dist/, _extensions/chromokit/, r/R/tokens.R, r/inst/pkgdown/
npm test             # node:test — the build is current, every --cx-* read is declared, the CLI round-trips
npm run site         # site/_build/
npm run screens      # screenshots of site/_build (and any examples in it), light and dark — needs Playwright
```

Generated files are committed. CI runs `npm run check`, which fails if any of
them is out of date.

**Taking up a newer look from chromosomix:**

```bash
npm run import -- ../chromosomix
npm run build
```

Then review the diff. `.github/workflows/drift.yml` compares the snapshot with
chromosomix every week and opens an issue when they differ. It never writes to
chromosomix.

**Adding a target:**

1. Add `adapters/<host>/` and an `ADAPTERS.<host>` function in
   `scripts/build.mjs`.
2. Add `templates/<target>/target.json` and `templates/<target>/files/`.
3. Add a build step to the `example` matrix in `.github/workflows/site.yml`.

## Workflows

- **ci.yml** runs on every push. It checks that the build is current, runs the
  tests, checks that every starter initialises and checks clean, checks the npm
  tarball's contents, and runs `R CMD check` on the R package.
- **site.yml** runs on pushes to main, pull requests, weekly and on demand.
  - It builds every starter with its own tool (Hugo, Zensical, Astro, Quarto,
    pkgdown by copy and by template package), plus chromokit's site.
  - It takes screenshots of everything, light and dark, and uploads them as
    the `screens` artifact; they are also published at `/screens/`.
  - On main, it deploys to GitHub Pages.
- **release.yml** runs on a `v*` tag.
  - It checks that the tag, `package.json`, `r/DESCRIPTION` and the Quarto
    extension agree.
  - It creates a GitHub release with zips of the kit, the Quarto extension and
    each starter.
  - It publishes to npm when the repository has an `NPM_TOKEN` secret.
- **drift.yml** runs weekly and compares the token snapshot with chromosomix.

**Releasing:**

1. Run `npm run version:set -- 0.2.0`. It sets the version in `package.json`
   and `r/DESCRIPTION` and rebuilds.
2. Add a `## [0.2.0]` section to `CHANGELOG.md`.
3. Commit, then push the tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

**One-time setup on GitHub:**

- Make the repository public.
- Under Settings → Pages, set the source to *GitHub Actions*.
- To publish to npm, add an `NPM_TOKEN` secret (an npm automation token).

## Licence

MIT. Interface icons are [Lucide](https://lucide.dev) (ISC). Brand marks are
[Simple Icons](https://simpleicons.org) (CC0). The palettes are chromosomix's.
