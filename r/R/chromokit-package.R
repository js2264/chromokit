#' chromokit: the 'chromokit' look for 'pkgdown' sites and 'ggplot2' plots
#'
#' Two things, from one set of design tokens:
#'
#' * a **pkgdown template package**. In a package's `_pkgdown.yml`:
#'
#'   ```yaml
#'   template:
#'     package: chromokit
#'   ```
#'
#'   and in its `DESCRIPTION`, so that CI installs it before building the site:
#'
#'   ```
#'   Config/Needs/website: js2264/chromokit/r
#'   ```
#'
#' * a **ggplot2 theme** and colour scales: [theme_chromokit()],
#'   [scale_colour_chromokit()], [scale_fill_chromokit()], and the tokens
#'   themselves as [chromokit_colours()].
#'
#' @keywords internal
"_PACKAGE"
