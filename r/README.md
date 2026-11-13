# chromokit for R

The R side of [chromokit](https://github.com/js2264/chromokit): a **pkgdown
template package** and a **ggplot2 theme**, from the kit's design tokens.

```r
pak::pak("js2264/chromokit/r")
```

## A package's pkgdown site

In `_pkgdown.yml`:

```yaml
template:
  package: chromokit
```

and in `DESCRIPTION`, so that the site's CI installs the template first:

```
Config/Needs/website: js2264/chromokit/r
```

That is all: Bootstrap 5, the light switch, the palettes, the header, code
frames, tables and callouts come with the template. Your own `pkgdown/extra.scss`
and `pkgdown/extra.css` still load after it.

To copy the files into the package instead of depending on this one, use
`npx github:js2264/chromokit init pkgdown`.

## Plots

```r
library(ggplot2)
ggplot(mtcars, aes(wt, mpg, colour = factor(cyl))) +
  geom_point() +
  scale_colour_chromokit() +
  theme_chromokit()            # theme_chromokit("dark") on a dark page
```

`chromokit_colours()` returns the tokens themselves; `chromokit_palette(n)`
the series colours.
