# examplepkg

An example package for chromokit's pkgdown starter: one function,
`contact_decay()`, one article and a news file.

## Installation

```r
pak::pak("example/examplepkg")
```

## Usage

```r
library(examplepkg)
contact_decay(c(1e3, 1e4, 1e5))
```

| Function | What it does |
|---|---|
| `contact_decay()` | The power law of a contact map |

> [!NOTE]
> A blockquote, which pkgdown draws as a callout.
