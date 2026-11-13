# Working in chromokit

chromokit is a UI kit: chromosomix's design tokens and components, built for six
hosts (plain HTML, Hugo, Zensical, Astro Starlight, pkgdown, Quarto) and copied
into projects by its own command line. Read README.md first.

## Commands

```bash
npm install            # icon packages the build reads (lucide-static, simple-icons)
npm run build          # write dist/, _extensions/chromokit/, r/R/tokens.R, r/inst/pkgdown/
npm run check          # the same, writing nothing; fails if any output is stale (CI runs this)
npm test               # node --test test/*.test.mjs
npm run site           # site/_build/ (chromokit's own site)
npm run screens        # screenshots of site/_build/ and any examples/ in it (needs Playwright)
node bin/chromokit.mjs init <target> <dir>   # try a starter
```

## Rules

- **Generated files are committed and never edited by hand**: everything in
  `dist/`, `_extensions/chromokit/`, `r/R/tokens.R` and `r/inst/pkgdown/`.
  Edit the source (`tokens/`, `src/`, `adapters/`, `lib/`), run `npm run build`,
  and commit both. `tokens/chromosomix.json` is written by
  `npm run import -- <chromosomix checkout>`, never by hand.
- **The core never styles a bare element.** Every rule in `src/css/components/`
  is on a `cx-` class, so the core drops into any host. Element defaults belong
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
- Version bumps go through `npm run version:set -- <x.y.z>`, which updates
  `package.json` and `r/DESCRIPTION` and rebuilds; `CHANGELOG.md` gets the
  section.
- The R package's `man/` and `NAMESPACE` are roxygen's: run
  `Rscript -e 'roxygen2::roxygenise()'` in `r/` after changing a roxygen
  comment.
