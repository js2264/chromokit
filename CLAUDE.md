# Working in chromokit

chromokit is a UI kit: chromosomix's design tokens and components, built for seven
hosts (plain HTML, Hugo, Zensical, Sphinx, Astro Starlight, pkgdown, Quarto) and copied
into projects by its own command line. It also holds the report kit, which the
project's Python tools write their reports with, and the copier template of their
repositories. Read README.md first.

## Commands

```bash
npm install            # icon packages the build reads (lucide-static, simple-icons)
npm run build          # write dist/, _extensions/chromokit/, r/R/tokens.R, r/inst/pkgdown/
npm run check          # the same, writing nothing; fails if any output is stale (CI runs this)
npm test               # node --test test/*.test.mjs
npm run test:report    # the report kit's Python tests (uv)
npm run test:template  # the copier template, rendered and applied (uv, node)
npm run site           # site/_build/ (chromokit's own site)
npm run screens        # screenshots of site/_build/ and any examples/ in it (needs Playwright)
node bin/chromokit.mjs init <target> <dir>   # try a starter
```

## Rules

- **Generated files are committed and never edited by hand**: everything in
  `dist/` (the report kit's `dist/report/` too), `_extensions/chromokit/`,
  `r/R/tokens.R` and `r/inst/pkgdown/`.
  Edit the source (`tokens/`, `src/`, `adapters/`, `lib/`), run `npm run build`,
  and commit both. `tokens/chromosomix.json` is written by
  `npm run import -- <chromosomix checkout>`, never by hand.
- **The core never styles a bare element.** Every rule in `src/css/components/`
  is on a `cx-` class, so the core drops into any host. (The one exception sets
  only a custom property: `[data-family]` and `[data-state]` give an element
  its `--cx-family` or `--cx-state`.) Element defaults belong
  in `src/css/page.css` (scoped under `.cx-page` / `.cx-prose`) or in an
  adapter.
- **Host prose rules must not repaint components.** Each host has a "links in
  the content" rule with an element in its selector (`.md-typeset a`,
  `.sl-markdown-content a`, `main a`). Exclude components from it
  (`:where(:not([class*='cx-']))`, `:not(.cx-button, …)`), or load the
  components after it (the Zensical bundle is tokens, then the adapter, then
  the components).
- **Author sizes in rem**: the build rewrites them to `calc(n * var(--cx-rem))`.
  A host whose root is not 16px (Zensical's is 20px) sets `--cx-rem`. Media
  queries keep plain rem.
- **The pkgdown Sass is compiled by libsass**, which evaluates `rgb()`, `min()`
  and `max()`. Shadows are emitted as hex-alpha, and the build refuses
  `rgb(… / …)`, `min(` and `max(` in `dist/pkgdown/extra.scss`.
- **Light/dark selectors live in `lib/selectors.mjs` only.** `data-theme` and
  `data-bs-theme` count on `<html>` only, because Bootstrap also puts
  `data-bs-theme` on single components (Quarto's navbar).
- **Starter files vs kit files**: a template's `files/` are starter files,
  written once with `{{name}}`-style placeholders filled. Its `target.json`
  `kit` map lists kit files, copied verbatim and hashed into the project's
  `chromokit.json`. Never put a placeholder in a kit file.
- **A change to what a host looks like is checked by looking at it.** Build the
  starter with the host's own tool and take screenshots, light and dark. On
  GitHub, `site.yml` does this for every target. Send the pictures with the
  change.
- **Each colour means one thing, and nothing is under 11 px** (chromomap's
  rules). `--cx-family-*` is a kind of data, `--cx-state-*` what a job is doing;
  neither is ever the only cue (a dot's shape, a ring's shape, a word).
  `test/colours.test.mjs` holds the families, the states and the plot series to
  chromomap's thresholds (contrast, ΔE, simulated colour blindness) with
  `lib/colour.mjs`; `test/sizes.test.mjs` fails on any font size under 11 px in
  `dist/`. Retune a colour against those tests, not by eye.
- **The report kit** (`adapters/report/` → `dist/report/`, copied by
  `chromokit add report` into `src/<package>/_report/`) is Python that sits in
  other packages:
  - it names no package and imports nothing outside the standard library but
    jinja2, markupsafe, yaml and pandas, lazily; its `report.txt` and
    `report_mqc.yaml` stay byte for byte metaTOR's (the fixture in
    `test/fixtures/report/metator/` is metaTOR's own output);
  - its source is formatted with ruff at 88 and linted with the conventions'
    rules (`npm run test:report` does both); the build stamps the copy in
    ASCII and marks it `# ruff: noqa` and `# fmt: off`, since its hosts lint
    and format at their own line lengths;
  - the page carries `report.css` and `report.js` inline: the build escapes
    `</style` and `</script`, and every `--cx-*` it reads is declared.
- **The copier template** (`copier.yml`, `template/`) renders with `[= … =]`,
  `[% … %]` and `[# … #]`; `trim_blocks` eats the newline after a tag, so a
  tag that ends a line of text is written `+%]`. Files a repository owns once
  written are `_skip_if_exists`, and there are no `_tasks`. A rendered
  `tests/test_docs.py` must stay formatted at every line length from 88 to
  130: short statements, no construct ruff would join. `npm run
  test:template` renders the six repositories' answers and applies the
  template to the samples in `test/fixtures/template/samples/`.
- Version bumps go through `npm run version:set -- <x.y.z>`, which updates
  `package.json` and `r/DESCRIPTION` and rebuilds; `CHANGELOG.md` gets the
  section.
- The R package's `man/` and `NAMESPACE` are roxygen's: run
  `Rscript -e 'roxygen2::roxygenise()'` in `r/` after changing a roxygen
  comment.
