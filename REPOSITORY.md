# Repository layout

Modular monorepo: Rust kernel, runnable apps, TypeScript SDK, protocol fixtures, maintainer scripts, and docs.

## Top-level map

| Path | Category | Contents |
| --- | --- | --- |
| [`apps/`](apps/) | Applications | `cli` (Rust CLI + node), `web` (Next.js client), `desktop` (Tauri v2) |
| [`crates/`](crates/) | Kernel | `protocol-core`, `policy`, `state-engine`, `reputation`, `node` |
| [`packages/`](packages/) | Shared TS | `sdk-ts` — typed HTTP client for the node API |
| [`fixtures/`](fixtures/) | Protocol proof | Checked-in valid/invalid JSONL event logs |
| [`scripts/`](scripts/) | Automation | Drills, readiness bundles, release helpers (`scripts/lib/` shared cores) |
| [`docs/`](docs/) | Documentation | Start at [`docs/START-HERE.md`](docs/START-HERE.md) |
| [`deploy/`](deploy/) | Production ops | Compose overrides, systemd, Windows backup task |
| [`docker/`](docker/) | Container build | Image context + entrypoint |
| [`.data/`](.data/) | **Local only** | Node databases and drill output — **never commit** |
| [`.dev/`](.dev/) | Dev config | CDP profile, dev port file (see [`.dev/README.md`](.dev/README.md)) |

Build artifacts (gitignored): `target/`, `node_modules/`, `dist/`, `apps/web/.next/`, `apps/web/out/`.

## Where to work

| Goal | Go to |
| --- | --- |
| Change protocol / replay | `crates/` + `fixtures/` |
| Run or change the node binary | `apps/cli/` |
| Marketplace / dashboard / explorer / transport UI | `apps/web/` |
| Desktop or mobile shell | `apps/desktop/` |
| Client API types and fetch helpers | `packages/sdk-ts/` |
| Run maintainer drills | `package.json` scripts → `scripts/` |
| Operate a node in production | `docs/runbooks/` + `deploy/` |
| Local node data directory | `.data/` — see [`.data/README.md`](.data/README.md); migrate legacy dirs with `pnpm repo:migrate-data-dirs` |

## Package managers

- **Rust:** `cargo` workspace (`Cargo.toml`)
- **TypeScript:** `pnpm` workspace (`pnpm-workspace.yaml`) — use `pnpm install`, not npm for workspace deps

## Quick commands

```bash
cargo test
cargo run --bin cli -- fixtures run
pnpm install
pnpm dev:web
pnpm r4:client-audit
pnpm r8:transport:smoke
```

Operator node (local):

```bash
cargo run --bin vectis-node -- node init --data-dir ./.data/default
cargo run --bin vectis-node -- node serve --data-dir ./.data/default --bind 127.0.0.1:7878
```

See [`docs/runbooks/operator-quickstart.md`](docs/runbooks/operator-quickstart.md).
