# CodaCtrl Studio Output Hub

Indexable studio outputs for this repository. Internal daemon state lives under `.codectx/`.

## Vectis × CodaCtrl (use cases + security)

Start here: **[USE-CASE-MAP.md](USE-CASE-MAP.md)** · [docs/runbooks/codactrl-studio-runbook.md](../docs/runbooks/codactrl-studio-runbook.md)

| Area | Path |
|------|------|
| Verify scenarios | `../verify.scenarios.yaml` (repo root) |
| Operations | `../verify.operations.yaml` |
| Stress sandbox | [sandbox/sandbox.catalog.yaml](sandbox/sandbox.catalog.yaml) |
| Security hygiene | [sandbox/hygiene.catalog.yaml](sandbox/hygiene.catalog.yaml) |
| FLS | [logic/](logic/) |

Open this repo as a CodaCtrl Studio workspace. Protocol AB/SCN fixtures remain authoritative in Vectis (`cargo` / `pnpm` gates).

## Modules

### Technical survey (`technical`)
- Module readme: [technical/README.md](technical/README.md)

## Machine index

See [`index.json`](index.json) for the full entry catalog.

## Git

`.codectx/` holds daemon machine state (typically gitignored). `.codactrl/` is the agent navigation hub.
