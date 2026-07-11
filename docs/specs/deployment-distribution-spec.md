# Deployment and Distribution Spec

Purpose: define what "production-ready deployment" means for the Vectis restart era and how operators install, run, back up, and upgrade a node.

Status: `locked`

Last updated: July 2026

## Deployment philosophy

Vectis deployment must be **boring**:

- a competent operator follows docs once and gets a running node
- no manual database surgery for normal workflows
- backup/restore is file-based and verifiable
- upgrades preserve event log compatibility or fail closed with explicit errors

This spec optimizes for **solo operators and small communities**, not hyperscale cloud.

## Operator personas

| Persona | Needs |
| --- | --- |
| **Maintainer** | dev loop, tests, fixtures, evidence scripts |
| **First operator** | install, serve, ingest, snapshot, restore |
| **Peer operator** | sync pull, bootstrap, read token config |
| **Community admin** | policy pack selection, lane templates, invite onboarding |

## Minimum deployment unit

One **operator instance** consists of:

```text
<data-dir>/
  events.jsonl          # append-only canonical log
  node.db               # SQLite indexes (rebuildable from log)
  snapshots/            # checkpoint files (format_version >= 4)
  peers.json            # optional sync peers + read tokens
  manifest.json         # kernel versions, created_at (R1 target)
```

Runtime process:

```bash
vectis-node serve --data-dir <path> --bind 127.0.0.1:7878
```

During transition, `cargo run --bin cli -- node serve ...` remains valid.

## Distribution artifacts (R1 targets)

| Artifact | Purpose | Priority |
| --- | --- | --- |
| `vectis-node` release binary (Linux x64, Windows x64) | operator install without Rust toolchain | P0 |
| `docker-compose.yml` + pinned image | repeatable container deployment | P0 |
| `install.sh` / `install.ps1` | download binary, init data dir, print next steps | P1 |
| `policy/default.json` export | visible default policy snapshot | P1 |
| npm `@vectis/sdk-ts` (rename optional) | client integration | P2 |

## Install flow (target UX)

### Fresh install

1. Download binary or pull container image
2. Run `vectis-node init --data-dir ./.data/default`
3. Run `vectis-node serve --data-dir ./.data/default --bind 127.0.0.1:7878`
4. Verify: `GET /health` returns OK + version manifest
5. Optional: `vectis-node ingest --data-dir ./.data/default --in fixtures/valid/...`

### Client connection

1. Web or SDK points at `http://127.0.0.1:7878` (or operator hostname)
2. Identity keys generated locally (never sent to server except as signed events)
3. Onboarding via invite/vouch flow per existing alpha runbook

## Backup and restore

### Backup (operator)

Required artifacts:

- `events.jsonl` (mandatory)
- `snapshots/` latest checkpoint (recommended)
- `peers.json` if sync configured

Command target (R1):

```bash
vectis-node snapshot create --data-dir <path> --out backup/snapshot.json
# copy events.jsonl + snapshot + peers.json
```

### Restore

1. Initialize fresh data dir
2. Import snapshot: `vectis-node sync bootstrap --data-dir <path> --peer <url>`
   OR copy `events.jsonl` and rebuild indexes via ingest
3. Verify replay equivalence:

```bash
vectis-node db inspect --data-dir <path>
cargo run --bin cli -- log replay --in <events.jsonl> --out /tmp/state.json
```

Restore must preserve `K-04` (genesis ≡ snapshot+delta).

## Upgrade path

### Patch upgrade (same event envelope v0)

1. Stop node
2. Replace binary/image
3. Start node — automatic SQLite migrations if any
4. Run `npm run v1:preflight` or operator preflight script

### Protocol version upgrade (future v1 envelope)

Requires cutover per `docs/architecture/event-versioning-strategy.md`:

- mixed-version fixture bundle passes
- explicit `--allow-event-version v1` operator flag
- rollback plan documented before activation

## Configuration surface

| File / flag | Scope |
| --- | --- |
| `--data-dir` | all persistence |
| `--events-log-hash-chain` | enable `events.chain.jsonl` tamper detection at init (default off) |
| `--bind` | HTTP listen address |
| `--ingest-rate-limit-max` | HTTP `POST /events` requests per client per window (`0` = disabled) |
| `--ingest-rate-limit-window-seconds` | rolling window for ingest rate limit (default `60`) |
| `peers.json` | sync peers, read tokens, backoff |
| embedded policy | default; overridable via future policy packs |
| env `VECTIS_LOG` | structured log level (R1 target) |

Secrets:

- signing keys stay **client-side**
- `read_token` in `peers.json` protects event/snapshot reads only

## Customization model (R2+)

Communities customize via **policy packs**, not kernel forks:

| Customizable | Mechanism | Kernel fork required? |
| --- | --- | --- |
| Lane template availability | policy + UI config | No |
| Credit decay/demurrage params | `PolicyUpdate` events | No |
| Issuance rate limits | policy EC-2 params | No |
| Eligibility thresholds | policy EC-4 params | No |
| Branding / UX | client shell only | No |
| New event kinds | protocol version cutover | Yes |

## Cross-platform requirements

| Platform | R1 support | Notes |
| --- | --- | --- |
| Linux x64 | required | primary operator target |
| Windows x64 | required | maintainer dev environment |
| macOS arm64 | recommended | secondary dev target |
| ARM Linux (edge/off-grid) | deferred | evaluate after R2 proof |
| WASM/mobile embed | deferred | requires FFI spec |

## Deployment acceptance gates

| Gate | Criterion | Verification |
| --- | --- | --- |
| `RDG-1` | Non-author installs from release artifact in < 30 minutes | timed runbook drill |
| `RDG-2` | Health endpoint reports version + data dir status | API test |
| `RDG-3` | Backup + restore yields identical replay hash | scripted restore test |
| `RDG-4` | Docker compose brings up node + passes preflight | CI job (`.github/workflows/ci.yml`) |
| `RDG-5` | Alpha runbook works with release binary, not `cargo run` | GA6 drill variant | `npm run v1:ga6-drill:release` |

## Implementation slices

| ID | Scope | Depends on |
| --- | --- | --- |
| `R1-D1` | `vectis-node` release build (GitHub Actions or local) | `R1-K4` health endpoint |
| `R1-D2` | `vectis-node init` creates data dir + manifest | `R1-K5` |
| `R1-D3` | Docker compose + Dockerfile | `R1-D1` |
| `R1-D4` | Install scripts + operator quickstart doc | `R1-D2`, `R1-D3` |
| `R1-D5` | Release-runbook GA6 drill (`npm run v1:ga6-drill:release`) | `R1-D1` | `completed` |
| `R2-D1` | First persistent deployment evidence packet | `R1-D4`, first real exchange |
| `R2-D2` | Policy pack export/import documentation | policy timeline tests |

## Documentation deliverables

- `docs/runbooks/operator-quickstart.md` (R1 — new, implementation phase)
- update `docs/runbooks/alpha-operations-runbook.md` with release-binary paths
- update `README.md` with install-first commands

## Non-goals (restart era)

- managed cloud SaaS
- one-click global federation network
- automatic TLS certificate provisioning (operator responsibility in R1)
- Kubernetes helm charts (defer until demand)
