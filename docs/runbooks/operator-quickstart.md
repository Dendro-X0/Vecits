# Operator Quickstart

Purpose: minimum path from zero to a running Vectis node (restart era).

Last updated: July 2026

## Prerequisites

- Rust toolchain (development) **or** release binary from `dist/release/` or CI artifacts
- Optional: Node.js 20+ for web client and preflight scripts

## Development path

```bash
# 1. Initialize operator data directory
cargo run --bin vectis-node -- node init --data-dir ./.data/default

# 2. Start node
cargo run --bin vectis-node -- node serve --data-dir ./.data/default --bind 127.0.0.1:7878

# 3. Verify health
curl http://127.0.0.1:7878/health
```

## Release binary path

Build once, then use the resolved path (do **not** type literal `...`):

```bash
npm run v1:build-release

# Bash (Git Bash on Windows) — copy the printed path
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node init --data-dir ./.data/default
"$BIN" node serve --data-dir ./.data/default --bind 127.0.0.1:7878
curl http://127.0.0.1:7878/health
```

Windows PowerShell:

```powershell
npm run v1:build-release
.\scripts\install.ps1
$bin = npm run -s v1:resolve-release
& $bin node serve --data-dir .\.data\default --bind 127.0.0.1:7878
```

Or use the install helper (builds + inits):

```bash
./scripts/install.sh
```

## Docker path

```bash
docker compose up --build -d
curl http://127.0.0.1:7878/health
npm run v1:docker-smoke   # build, health-check, teardown
```

## Data directory layout

```text
.data/default/          # or any --data-dir you choose
  events.log
  events.chain.jsonl   # optional; present when hash chain enabled at init
  node.db
  manifest.json
  peers.json          # optional, for sync
  snapshots/          # created on snapshot commands
```

See [`.data/README.md`](../../.data/README.md) for named drill subdirectories.

Enable hash chain at init (optional, RES-07):

```bash
cargo run --bin vectis-node -- node init --data-dir ./.data/default --events-log-hash-chain
cargo run --bin cli -- log verify-chain --data-dir ./.data/default
```

## Next steps

- Ingest fixtures: `cargo run --bin vectis-node -- node ingest --data-dir ./.data/default --in fixtures/valid/marketplace-accept.jsonl`
- Run preflight: `npm run v1:readiness`
- Run operator runbook drill: `npm run v1:ga6-drill`
- Run release runbook drill (RDG-5): `npm run v1:ga6-drill:release`
- Two-node federation drill (R5-F2 / GA4 release): `npm run r5:two-node:drill`
- Ingest rate limit on public nodes: `--ingest-rate-limit-max 120` (see `docs/runbooks/operator-security-guide.md`)
- Persistent deployment (R2-P1): `docs/runbooks/r2-persistent-deployment-runbook.md`
- Zero-capital production (no VPS): `docs/runbooks/zero-capital-operator-runbook.md`
- After reboot (ZC cold-start): `docs/runbooks/zero-capital-cold-start-checklist.md` · `pnpm zc:cold-start`
- R2 deploy smoke: `npm run r2:deploy-smoke -- --with-backup`
- Daily backup: `npm run r2:backup`
- Client/kernel audit: `npm run r4:client-audit`
- Weekly evidence pack: `npm run r2:evidence-pack`
- R2 evidence export: `npm run r2:evidence-export`
- R2 restore drill: `npm run r2:restore-drill`
- Backup schedule: `docs/runbooks/operator-backup-runbook.md`
- Full alpha workflow: `docs/runbooks/alpha-operations-runbook.md`

## Related docs

- `docs/specs/deployment-distribution-spec.md`
- `docs/specs/zero-capital-operator-topology-design.md`
- `docs/specs/kernel-boundary-spec.md`
- `docs/roadmap/restart-roadmap.md`
