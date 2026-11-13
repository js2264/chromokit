#' Expected contact frequency at a distance
#'
#' The power law a Hi-C contact map falls off with: `P(s) ~ s^alpha`.
#'
#' @param s Genomic distances, in base pairs.
#' @param alpha The exponent; about -1 for a fractal globule.
#' @return The expected relative frequency at each distance.
#' @examples
#' contact_decay(c(1e3, 1e4, 1e5))
#' plot(contact_decay(10^(3:7)), log = "y", type = "b")
#' @export
contact_decay <- function(s, alpha = -1) {
  stopifnot(is.numeric(s), all(s > 0))
  s^alpha
}
