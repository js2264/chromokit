---
title: Quickstart
description: A first result with {{name}}, in three steps.
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

:::note
Every function has a command: `{{name}} run input.txt`. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> to search.
:::

:::caution
A caution aside. `danger` and `tip` are drawn too.
:::
