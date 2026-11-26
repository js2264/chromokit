# Command line

## Conventions

| Option | Description |
|---|---|
| `-v, --verbose` | Debug logging, on every command. |

## Commands

### `hello` { #hello }

| Option | Default | Description |
|---|---|---|
| `-n, --name` | world | Who to greet. |

```bash
# Its example's comment, which is not a heading
sampletool hello --shout
```

#### Shouting

| Option | Default | Description |
|---|---|---|
| `--shout/--no-shout` | off | In capitals. |

### `data show` { #data-show }

| Option | Default | Description |
|---|---|---|
| `-o, --output` | — | Where to write. |

#### `data clean` { #data-clean }

No option of its own: `--legacy`, its former name, is hidden.

### `fit` { #fit }

Two ways of fitting a model, which share their options; `fitting` is a
hidden alias of the group.

#### `fit fast` and `fit slow`

| Option | Default | Description |
|---|---|---|
| `--rounds` | 10 | How many rounds. |
| `--seed` | 0 | `slow` only: the seed of the sample. |
