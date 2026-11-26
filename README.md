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

chromokit also holds what the Python packages of the project share: the
[report kit](#a-tools-report), which writes a tool's report of a run, and the
[copier template](#the-template-of-a-python-repository) of a repository.

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

## A tool's report

The **report kit** is the report of one run of a tool, for one sample, in
three files: `<sample>.report.txt` (every number, for scripts), its row of
[MultiQC](https://multiqc.info)'s General Statistics table
(`<sample>.report_mqc.yaml`), and a page to read the run with
(`<sample>.report.html`), in chromokit's look, light and dark. It is
[metaTOR](https://github.com/koszullab/metaTOR)'s report, generalised, and
every tool of the project writes its report with it.

```bash
npx github:js2264/chromokit add report      # src/<package>/_report/, recorded in chromokit.json
```

`add` finds the package (the only one under `src/`, or `--package <name>`)
and copies the kit there; `sync` updates it and `check` refuses an edit, as
for a site's kit files. The kit names no package and imports none, so one
copy serves every tool. It needs `jinja2>=3.1` and `pyyaml>=6.0` (and pandas
for `read_txt`).

```python
from ._report import Report, Tool, read_txt, report_section, write_report

TOOL = Tool(
    name="metaTOR",
    version=__version__,
    format_version=1,                     # the report's format, raised when a key, column or unit changes
    columns=[                             # the General Statistics columns: key, section, MultiQC's pconfig
        ("contigs_bp", "contigs", {"title": "Assembly", "suffix": " bp", "format": "{:,.0f}"}),
    ],
    description="metaTOR runs: the MAGs of the map of each run",
    docs="https://koszullab.github.io/metator/formats/#the-report-of-a-run",
    template=Path(__file__).parent / "templates" / "report.html.j2",
)

report = Report(sections={"report": report_section(TOOL, "S1", {"map": "out/S1.metacool"}),
                          "contigs": {"contigs": 55, "contigs_bp": 578000}},
                tables={"mags": mags})          # pandas DataFrames
write_report(report, "out", TOOL, figures=figures, inputs={"Map": "out/S1.metacool"})
```

- **report.txt:** `[section]`, then a key and its value per line;
  `[table: name]`, then a header and a row per line; `NA` when missing.
  Integers as integers, `_pct` with 2 decimals, `_ratio` and `_fraction`
  with 4. `read_txt` reads it back.
- **report_mqc.yaml:** one `generalstats` section, under the tool's MultiQC
  id: every sample's file carries it, and MultiQC merges them into one table
  (and one sample's rows from two tools into one row).
- **The page:** a tool's template starts with
  `{% extends "_report/base.html.j2" %}`, imports `_report/macros.html.j2`
  (cards, facts, sortable and filterable tables with *Download CSV*, plots)
  and fills the base's blocks: `overview`, `sections` (and `nav`), `run`,
  `files`. Its plots are Plotly figures, drawn by plotly.js from its CDN at a
  pinned version: offline, the page keeps its numbers and tables. Each plot's
  chrome follows the page's palette; its data keeps its colours. Without a
  template of its own, the page shows every section and table as it comes.

[test/fixtures/report/metator](test/fixtures/report/metator) is the sample:
metaTOR's report of a run, which the kit writes byte for byte as metaTOR
does, and its page ported to the kit
([report.html.j2](test/fixtures/report/metator/report.html.j2)).

## The template of a Python repository

The project's Python repositories share one [copier](https://copier.readthedocs.io)
template, in [template/](template/), named by [copier.yml](copier.yml), and
versioned by chromokit's tags. It holds what [the conventions](https://github.com/koszullab/.github/blob/main/CONVENTIONS.md)
make the same everywhere: the `pyproject.toml` blocks and the tools'
configuration, pre-commit, `.editorconfig`, `.gitattributes`, the workflows
(CI, the changelog check, the docs, the release, Dependabot's), the docs'
skeleton and `tests/test_docs.py`, `CITATION.cff` and `AGENTS.md`.

```bash
uvx copier copy --vcs-ref v0.2.0 gh:js2264/chromokit .     # once, answering its questions
uvx copier update                                          # a newer tag, merged into the repository's changes
```

- **Its questions:** the distribution, its import package and command; the
  owner and the default branch; the docstring style and the line length; the
  image and its base; compiled dependencies (the `wheels` job); nothing
  needed outside PyPI (an empty `PATH` in the `install` job); a GPU. The
  answers go in `.copier-answers.yml`, which the repository commits.
- **Written once:** README, `AGENTS.md`, `CITATION.cff`, the docs' pages and
  the Dockerfile become the repository's (`_skip_if_exists`). The other files
  are the template's, and `copier update` merges its changes into the
  repository's own.
- **Nothing runs:** no `_tasks`, so applying it never needs `--trust`.
  chromokit's docs kit and report kit are not copier's: `chromokit init
  zensical` and `chromokit add report` put them in.
- **Its own Jinja** is `[= … =]`, `[% … %]` and `[# … #]`, since GitHub's
  expressions are `${{ … }}` and TOML's tables `[[ … ]]`.

[test/template](test/template) renders it with the answers of metacooler,
hicstuff, metaTOR, instaGRAAL, chromosight and tinymapper
([answers](test/fixtures/template/answers)) and checks the result (actionlint,
zizmor, the files parsed, the citation validated); then applies it to three
sample packages, a click group, console scripts and a docopt command line,
and runs what their CI would: `uv lock`, the tests, ruff, ty, pre-commit, the
docs' build, bump-my-version, the build, and the install job's own scripts.

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
adapters/report/   the report kit's sources: the writers, the page's templates, its stylesheet and script
template/          the copier template of a Python repository; copier.yml, at the root, names it
lib/               the command line, the mark generator, the light/dark selectors
dist/              generated: everything above, built per host (committed, so copies and CDN links need no build);
                   dist/report/ is the report kit as `chromokit add report` copies it
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
npm run test:report    # the report kit, with uv: metaTOR's sample, read_txt, MultiQC, ruff and ty
npm run test:template  # the copier template, with uv: the six repositories' answers, the samples
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
  tarball's contents, and runs `R CMD check` on the R package. It runs the
  report kit's tests (Python 3.10 at the dependencies' floors, and the newest
  Python) and the template's.
- **site.yml** runs on pushes to main, pull requests, weekly and on demand.
  - It builds every starter with its own tool (Hugo, Zensical, Astro, Quarto,
    pkgdown by copy and by template package), plus chromokit's site and the
    report kit's sample page.
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
