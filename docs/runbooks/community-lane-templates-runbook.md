# Community Lane Templates Runbook (R6-L2)

Purpose: guide community admins and operators through selecting, verifying, and running marketplace lane templates.

Last updated: July 2026

## Audience

- **Community admin** — picks which lanes the node policy allows
- **Operator** — posts offers and runs exchanges on chosen lanes
- **Provider** — delivers milestone evidence in the lane's required format

Catalog reference: [../architecture/lane-template-catalog.md](../architecture/lane-template-catalog.md).

## 1. Choose lanes for your community

Start with **digital artifact lanes** unless you have offline evidence tooling:

| If the work looks like… | Lane |
| --- | --- |
| Bugfix / CI repair | `software-fixes` |
| Small bounded feature | `feature-work` |
| Docs / README / changelog | `documentation` |
| Translation package | `translation` |
| Test report / reproduction | `testing` |
| Research brief / analysis | `research` |
| Stalled repo maintenance | `project-maintenance` |
| Deterministic compute with receipt | `compute-job` (see [compute-job-lane-runbook.md](compute-job-lane-runbook.md)) |

Avoid `local-resource-exchange` and `physical-handoff` for first deployment — experimental offline lanes (R6-L3).

## 2. Verify before go-live

### Fixture replay (kernel truth)

```bash
cargo run --bin cli -- fixtures run
```

### R6-L2 lane template smoke (artifact lanes + registry alignment)

```bash
npm run v1:build-release
npm run r6:lane-templates:smoke
```

Pass criteria: `R6-L2 lane template smoke passed` with all seven artifact lanes `closed`.

Quick registry check without HTTP drills:

```bash
npm run r6:lane-templates:smoke -- --fixtures-only
```

### Discovery classifier (optional)

```bash
npm run v3:discovery-bridge:smoke
```

## 3. Run a single-lane exchange drill

Use release binary + dedicated data dir per lane proof:

```bash
npm run r2:exchange-drill -- --lane documentation --data-dir ./.data/r6-pd-documentation
npm run r2:exchange-drill -- --lane feature-work --data-dir ./.data/r6-pd-feature-work
```

Supported `--lane` values: all entries in the [lane template catalog](../architecture/lane-template-catalog.md#digital-artifact-lanes-community-deployable).

Compute-job uses a separate receipt drill:

```bash
npm run r6:compute-job:drill
```

## 4. Policy pack considerations

When exporting/importing policy packs, ensure `allowedServiceTypes` includes the lanes your community enables.

Drill:

```bash
npm run r5:policy-pack:import-drill
```

## 5. Human operator workflow (summary)

1. Provider with sponsor vouches posts `ServiceOffer` using the lane `serviceType`.
2. Buyer opens `ServiceOrder` + escrows credits (`SpendCredits`).
3. Provider posts `ServiceDelivery` with `artifactHash` evidence (or lane-specific receipt format).
4. Buyer posts `ServiceAccept` or `ServiceDispute`.
5. Verify order closed: `GET /state/order/<orderId>?as_of=<RFC3339>`.

Web builder: marketplace event builder lane template selector pre-fills contract fields.

## What does not count as lane proof

- Ingesting fixtures directly into production log without HTTP `POST /events`
- Offers with `serviceType` / `deliveryMode` / evidence format mismatched to lane template
- Subjective quality disputes expecting human arbitration in kernel

## Related docs

- [operator-quickstart.md](operator-quickstart.md)
- [r2-exchange-runbook.md](r2-exchange-runbook.md)
- [compute-job-lane-runbook.md](compute-job-lane-runbook.md)
- [policy-pack-export-import.md](policy-pack-export-import.md)
