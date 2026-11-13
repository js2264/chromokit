#' chromokit's colours
#'
#' The design tokens of one palette, by name: `bg`, `text`, `accent`, `ok`,
#' `warn`, `danger`, `border`, … as chromokit's CSS has them (without the
#' `--cx-` prefix).
#'
#' @param mode `"light"` or `"dark"`.
#' @return A named character vector of hex colours.
#' @examples
#' chromokit_colours()[c("accent", "text", "bg")]
#' chromokit_colours("dark")[["accent"]]
#' @export
chromokit_colours <- function(mode = c("light", "dark")) {
  mode <- match.arg(mode)
  unlist(.cx_tokens[[mode]])
}

#' Categorical colours
#'
#' The series colours of a palette, in order: the accent first, then the
#' semantic hues, then two quiet ones. Colour means something; a plot with
#' more than six series wants a legend more than a seventh colour.
#'
#' @inheritParams chromokit_colours
#' @param n How many colours.
#' @return A character vector of `n` hex colours.
#' @examples
#' chromokit_palette(3)
#' @export
chromokit_palette <- function(n = 6, mode = c("light", "dark")) {
  mode <- match.arg(mode)
  series <- .cx_tokens$series[[mode]]
  if (n > length(series)) {
    warning("chromokit has ", length(series), " series colours; recycling them for ", n, call. = FALSE)
  }
  rep_len(series, n)
}

#' A ggplot2 theme in chromokit's look
#'
#' Quiet axes and gridlines in the hairline colour, text in the kit's ink, a
#' left-aligned semibold title, no box around the legend. On `"dark"` the
#' plot sits on the dark page colour.
#'
#' @inheritParams chromokit_colours
#' @param base_size Base font size, in points.
#' @param base_family Base font family; `""` uses the device's default.
#' @param grid Which gridlines to draw: `"xy"`, `"x"`, `"y"` or `"none"`.
#' @return A ggplot2 theme.
#' @examples
#' if (requireNamespace("ggplot2", quietly = TRUE)) {
#'   library(ggplot2)
#'   ggplot(mtcars, aes(wt, mpg, colour = factor(cyl))) +
#'     geom_point() +
#'     scale_colour_chromokit() +
#'     theme_chromokit()
#' }
#' @export
theme_chromokit <- function(mode = c("light", "dark"), base_size = 11, base_family = "",
                            grid = c("xy", "x", "y", "none")) {
  check_ggplot2()
  mode <- match.arg(mode)
  grid <- match.arg(grid)
  p <- chromokit_colours(mode)
  line <- ggplot2::element_line(colour = p[["border"]], linewidth = 0.3)
  blank <- ggplot2::element_blank()
  ggplot2::theme_minimal(base_size = base_size, base_family = base_family) +
    ggplot2::theme(
      text = ggplot2::element_text(colour = p[["text"]]),
      plot.background = ggplot2::element_rect(fill = p[["bg"]], colour = NA),
      panel.background = ggplot2::element_rect(fill = p[["bg"]], colour = NA),
      plot.title = ggplot2::element_text(face = "bold", hjust = 0, colour = p[["text"]]),
      plot.title.position = "plot",
      plot.subtitle = ggplot2::element_text(colour = p[["text-dim"]], hjust = 0),
      plot.caption = ggplot2::element_text(colour = p[["text-faint"]], hjust = 0),
      axis.text = ggplot2::element_text(colour = p[["text-dim"]]),
      axis.title = ggplot2::element_text(colour = p[["text"]]),
      axis.line = ggplot2::element_line(colour = p[["border-strong"]], linewidth = 0.4),
      axis.ticks = ggplot2::element_line(colour = p[["border-strong"]], linewidth = 0.3),
      panel.grid.major.x = if (grid %in% c("xy", "x")) line else blank,
      panel.grid.major.y = if (grid %in% c("xy", "y")) line else blank,
      panel.grid.minor = blank,
      legend.key = blank,
      legend.text = ggplot2::element_text(colour = p[["text-dim"]]),
      legend.title = ggplot2::element_text(colour = p[["text"]]),
      strip.text = ggplot2::element_text(colour = p[["text"]], face = "bold", hjust = 0),
      strip.background = ggplot2::element_rect(fill = p[["bg-sunken"]], colour = NA)
    )
}

#' Colour scales from chromokit's series
#'
#' Discrete scales for `colour` and `fill` from [chromokit_palette()].
#'
#' @inheritParams chromokit_colours
#' @param ... Passed to [ggplot2::discrete_scale()].
#' @return A ggplot2 scale.
#' @examples
#' if (requireNamespace("ggplot2", quietly = TRUE)) {
#'   library(ggplot2)
#'   ggplot(mpg, aes(class, fill = drv)) + geom_bar() + scale_fill_chromokit()
#' }
#' @export
scale_colour_chromokit <- function(..., mode = c("light", "dark")) {
  check_ggplot2()
  mode <- match.arg(mode)
  ggplot2::discrete_scale("colour", palette = function(n) chromokit_palette(n, mode), ...)
}

#' @rdname scale_colour_chromokit
#' @export
scale_color_chromokit <- scale_colour_chromokit

#' @rdname scale_colour_chromokit
#' @export
scale_fill_chromokit <- function(..., mode = c("light", "dark")) {
  check_ggplot2()
  mode <- match.arg(mode)
  ggplot2::discrete_scale("fill", palette = function(n) chromokit_palette(n, mode), ...)
}

check_ggplot2 <- function() {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("This needs the ggplot2 package: install.packages(\"ggplot2\")", call. = FALSE)
  }
}
