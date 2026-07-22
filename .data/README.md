# Local node data (`.data/`)

This directory holds **local-only** `vectis-node` databases: event logs, SQLite indexes, manifests, and peers files.

**Do not commit** contents of this folder. Scripts and runbooks use named subdirectories so drill output stays out of the repository root.

## Layout

| Path | Purpose |
| --- | --- |
| `.data/default/` | Fresh operator init (`install.sh` / quickstart default) |
| `.data/dev/` | Local web client development |
| `.data/r2/` | R2 persistent deployment / exchange proof |
| `.data/zc1/` | Zero-capital ZC-1 solo desktop persistent host |
| `.data/r2-genesis/` | Trust bootstrap genesis drill |
| `.data/r6/` | Compute-job lane drill |
| `.data/r6-l2/` | Lane template smoke |
| `.data/r6-test/` | R6 maintainer scratch tests |
| `.data/r6-docs-test/` | Documentation lane scratch tests |
| `.data/r6-pd-<lane>/` | Post-deployment solo HTTP drill per lane |
| `.data/source/` · `.data/sink/` | Two-node federation drill |

Override any path with `--data-dir` on drill scripts.

## Migrate legacy root directories

If you still have `vectis-data*` folders at the repo root:

```bash
pnpm repo:migrate-data-dirs -- --dry-run   # preview
pnpm repo:migrate-data-dirs                # move into .data/
```

Mapping:

| Legacy (root) | New (`.data/`) |
| --- | --- |
| `vectis-data` | `default` |
| `vectis-data-r2` | `r2` |
| `vectis-data-r2-genesis` | `r2-genesis` |
| `vectis-data-r6` | `r6` |
| `vectis-data-r6-l2` | `r6-l2` |
| `vectis-data-r6-test` | `r6-test` |
| `vectis-data-r6-docs-test` | `r6-docs-test` |
| `vectis-data-r6-pd-<lane>` | `r6-pd-<lane>` |
| `vectis-data-source` / `vectis-data-sink` | `source` / `sink` |

Skips targets that already contain node data unless you pass `--force`.
