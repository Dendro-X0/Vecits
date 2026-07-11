# Vectis

Vectis is a modular coordination and settlement protocol for digital skills and services — deployable like infrastructure, integrable like Stripe, customizable like Shopify.

This repo hosts the reference implementation: Rust kernel, `vectis-node` operator runtime, TypeScript SDK, and the official Vectis client (`apps/web`). Operators may run the kernel alone or launch **their own branded stores and marketplaces** on top. See [`docs/foundation/product-identity.md`](docs/foundation/product-identity.md).

**Repository map:** [`REPOSITORY.md`](REPOSITORY.md)

**Restart (July 2026):** R0–R2, R4-C1–C4, R7 professional client, and **R8 convenience transport** complete. Local operator path:

```bash
npm run v1:build-release
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node init --data-dir ./.data/default
"$BIN" node serve --data-dir ./.data/default --bind 127.0.0.1:7878
```

See [`docs/START-HERE.md`](docs/START-HERE.md) for orientation · [`docs/runbooks/operator-quickstart.md`](docs/runbooks/operator-quickstart.md) to run a node · [`docs/runbooks/release-packaging-ci.md`](docs/runbooks/release-packaging-ci.md) for CI release artifacts.

## Workspace

| Path | Role |
| --- | --- |
| `crates/` | Rust kernel — protocol-core, policy, state-engine, reputation, node |
| `apps/cli` | Key generation, signing, replay, fixtures, `vectis-node` binary |
| `apps/web` | Next.js client (marketplace, dashboard, explorer, transport import/handoff) |
| `apps/desktop` | Tauri v2 desktop + mobile scaffold |
| `packages/sdk-ts` | Typed HTTP client for the node API |
| `fixtures/` | Checked-in valid/invalid JSONL event logs |
| `scripts/` | Maintainer drills and readiness bundles |
| `.data/` | **Local only** — node databases and drill output ([`.data/README.md`](.data/README.md)) |

## Commands

- `cargo test`
- `cargo run --bin cli -- fixtures run`
- `pnpm install` && `pnpm dev:web`
- `pnpm r4:client-audit`
- `pnpm ci:readiness` — PR CI gate bundle
- `pnpm r8:transport:smoke` — R8 QR/bundle/handoff smoke

Full CLI reference: `cargo run --bin cli -- --help`

## TypeScript workspace

- `pnpm install`
- `pnpm --filter @new-start/sdk-ts typecheck`
- `pnpm dev:web`
