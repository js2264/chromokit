test_that("both palettes carry the same names, as hex colours", {
  light <- chromokit_colours("light")
  dark <- chromokit_colours("dark")
  expect_setequal(names(light), names(dark))
  expect_true(all(grepl("^#[0-9a-f]{6}", c(light[c("bg", "text", "accent")], dark[c("bg", "text", "accent")]))))
  expect_false(identical(light[["bg"]], dark[["bg"]]))
})

test_that("the series start with the accent and recycle with a warning", {
  expect_equal(chromokit_palette(1), unname(chromokit_colours()[["accent"]]))
  expect_warning(p <- chromokit_palette(8), "recycling")
  expect_length(p, 8)
})

test_that("the pkgdown template ships its Sass and its settings", {
  scss <- system.file("pkgdown", "BS5", "extra.scss", package = "chromokit")
  yml <- system.file("pkgdown", "_pkgdown.yml", package = "chromokit")
  expect_true(file.exists(scss))
  expect_true(file.exists(yml))
  expect_match(paste(readLines(scss), collapse = "\n"), "--cx-accent")
})

test_that("the ggplot2 theme builds", {
  skip_if_not_installed("ggplot2")
  expect_s3_class(theme_chromokit(), "theme")
  expect_s3_class(theme_chromokit("dark", grid = "y"), "theme")
  expect_s3_class(scale_fill_chromokit(), "ScaleDiscrete")
})
