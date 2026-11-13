---
title: Quickstart
description: A first result, in three steps.
weight: 2
---

## Inputs

| File | What it is |
|---|---|
| `input.txt` | The data to read |
| `config.toml` | *(optional)* settings |

## Run it

```python
import {{name}}

result = {{name}}.run("input.txt", threads=4)
print(result.summary())
```

{{< callout title="From the command line" >}}
Every function has a command: `{{name}} run input.txt`. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to search.
{{< /callout >}}

## Next

{{< callout variant="warn" title="A warning" >}}
`danger`, `ok` and `quiet` callouts are drawn too.
{{< /callout >}}
