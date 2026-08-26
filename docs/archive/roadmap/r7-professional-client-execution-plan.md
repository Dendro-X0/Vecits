# R7 Professional Client — Execution Plan

Purpose: define the **next implementation goal** after kernel/deployment proof (R0–R2): a **professional official Vectis client** — marketplace platform UI wrapped in **Tauri v2**, self-hosted, cross-platform.

Status: `active`

Kickoff: July 2026

Last updated: July 2026

## Decision

**Engine core is complete** for restart v1 (R1–R2, RG-1..RG-4). Primary engineering focus shifts to the **official client**.

| Choice | Decision |
| --- | --- |
| Shell | **Tauri v2** — lightweight installers, small bundles, one web codebase |
| UI source | Existing **`apps/web`** (Next.js) — marketplace + explorer + onboarding |
| Settlement authority | **`vectis-node`** sidecar (Rust) — never reimplemented in Tauri or web |
| Mobile | **Tauri v2 iOS/Android** after desktop MVP (same UI, phased) |
| Reference pattern | Aperio desktop (`E:\Web Projects\aperio\docs\app\desktop.md`) — adapted for node sidecar, not embedded Next API server |

Product vision: [../foundation/platform-vision-exploration.md](../foundation/platform-vision-exploration.md), [../foundation/collaboration-value-doctrine.md](../foundation/collaboration-value-doctrine.md).

## Architecture

```text
┌─────────────────────────────────────────┐
│  apps/desktop (Tauri v2)                │
│  WebView → apps/web UI                  │
│  Rust: sidecar supervisor, key vault,   │
│        deep links, auto-update (later)  │
└──────────────┬──────────────────────────┘
               │ HTTP 127.0.0.1:7878
               ▼
┌─────────────────────────────────────────┐
│  vectis-node (bundled or PATH)          │
│  data-dir · events.log · replay truth   │
└─────────────────────────────────────────┘
               ▲
               │ sign + submit (client-side keys)
┌──────────────┴──────────────────────────┐
│  @new-start/sdk-ts (→ @vectis/*)        │
└─────────────────────────────────────────┘
```

**Unlike Aperio desktop:** Vectis does not embed a Next.js **API server** for product logic. The web app is a **thin client** over `vectis-node`. Tauri supervises the **node binary**, not `node server.js` for settlement.

## Non-goals (R7)

- Rewriting settlement in TypeScript (R4 audit rules stand)
- Requiring public blockchain or wallet connect
- OAuth-only identity (Ed25519 key + optional passkey vault)
- Marketplace UI polish blocking kernel releases (kernel frozen unless regression)

## Track overview

| Phase | ID | Goal | Gate |
| --- | --- | --- | --- |
| **Desktop MVP** | R7-D1..D5 | Installable desktop app, node sidecar, marketplace pass | `RG-7` pass |
| **Discovery UX** | R7-X1 | Aperio draft import in marketplace (absorbs R3-B5) | `RG-5` boost |
| **Mobile** | R7-M1..M3 | Tauri iOS/Android shells | post-RG-7 |

## Slices

### R7-D1 — Tauri v2 desktop scaffold

**Scope:** `apps/desktop` with Tauri v2, dev loop, window → `apps/web`.

| Deliverable | Acceptance |
| --- | --- |
| `apps/desktop/src-tauri/` | `cargo tauri dev` opens web UI |
| Workspace scripts | `pnpm dev:desktop`, `pnpm build:desktop` |
| Dev mode | `beforeDevCommand` starts `@new-start/web` on `:3000`; WebView loads app |
| Branding | App id `com.vectis.desktop`, product name **Vectis** |

**Proof:** developer runs `pnpm dev:desktop` on Windows; window shows current web home after sidecar health gate.

### R7-D2 — `vectis-node` sidecar supervisor

Implemented in `apps/desktop/src-tauri/src/node_sidecar.rs`:

- Spawns `vectis-node node serve` into per-user app data (`vectis-data/`) if `:7878` is not already healthy
- Runs `node init` on first launch
- Hides main window until health passes; stops sidecar on app exit
- Dev builds use Next `/api/node` proxy; release builds inject `__VECTIS_NODE_URL__`
- Node HTTP server enables loopback CORS for desktop WebView direct access

**Proof:** `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` + `cargo build --bin vectis-node`

### R7-D2 — `vectis-node` sidecar supervisor

**Scope:** Tauri starts/stops/monitors bundled `vectis-node` for local operator mode.

| Deliverable | Acceptance |
| --- | --- |
| Sidecar spawn | On app launch: `vectis-node node serve --data-dir <app_data> --bind 127.0.0.1:7878` |
| Health gate | WebView navigates only after `GET /health` OK |
| Data dir | Per-user `%APPDATA%/com.vectis.desktop/vectis-data` (or platform equivalent) |
| First run | `node init --data-dir` if manifest missing |
| Bundled binary | Release build includes `vectis-node` from `npm run v1:build-release` |

**Proof:** fresh install → health green → onboarding wizard reaches kernel without manual CLI.

### R7-D3 — Professional marketplace UX (absorbs R4-C5) — **complete**

**Scope:** Simplify official client for **marketplace platform** positioning — not operator debug panels first.

| Deliverable | Acceptance |
| --- | --- |
| Primary nav | Marketplace · Explore · Identity · Settings |
| Marketplace flow | Offer → order → milestone chain with kernel truth labels |
| Operator tools | Moved to Settings → Advanced (preflight, evidence export) |
| SOC-01 | Off-protocol warning on marketplace entry |
| `npm run r4:client-audit` | still passes |

**Proof:** scripted walkthrough doc + screenshot checklist; exchange drill runnable from desktop data dir.

### R7-D4 — Secure key storage — **complete**

**Scope:** Reduce raw hex secret key friction in desktop client.

| Deliverable | Acceptance |
| --- | --- |
| Tauri store plugin | Encrypted local vault for Ed25519 secret key |
| Import/export | Encrypted backup file format (documented) |
| Web fallback | Browser localStorage path unchanged for PWA |

**Proof:** key persists across app restart; export/import round-trip in test doc.

### R7-D5 — Desktop release artifacts — **complete**

**Scope:** Lightweight installers per platform.

| Deliverable | Acceptance |
| --- | --- |
| Windows | NSIS `.exe` |
| macOS | `.dmg` (CI or doc build path) |
| Linux | `.deb` or AppImage (one target minimum) |
| Size budget | Document bundle size; prefer sidecar binary over duplicating full dev toolchain |

**Proof:** `npm run build:desktop` produces installer; smoke: install → health → one ingest.

### R7-X1 — Discovery draft import (R3-B5) — **complete**

**Scope:** Import `v3:discovery-bridge` offer drafts into marketplace builder.

| Deliverable | Acceptance |
| --- | --- |
| File picker / paste JSONL | Maps to builder prefill |
| Lane label | Shows classifier `suggestedLane` |
| Non-authoritative label | Draft ≠ ingested offer until signed + accepted |

**Proof:** `npm run v3:discovery-bridge:e2e` output importable in desktop marketplace.

### R7-M1 — Mobile scaffold (in progress)

Android scaffold initialized at `apps/desktop/src-tauri/gen/android` with workspace scripts:

- `npm run r7:mobile:android:init`
- `npm run r7:mobile:android:dev`
- `npm run r7:mobile:android:build`
- `npm run r7:mobile:scaffold-smoke`

iOS scaffold remains deferred to macOS host. Sidecar policy is locked to remote pinned node for R7-M2 (`docs/specs/mobile-sidecar-policy-spec.md`); on-device sidecar is deferred.

#### iOS scaffold tooling (prepared)

- iOS scaffold spec: `docs/specs/r7-m1-ios-scaffold-spec.md`
- iOS pinned-node env injection wrapper: `scripts/r7-mobile-ios-command.mjs` (wired as `npm run r7:mobile:ios:*`)
- iOS scaffold smoke: `scripts/r7-ios-scaffold-smoke.mjs` (wired as `npm run r7:ios:scaffold-smoke`)

### R7-M2 — Remote pinned node wiring (complete)

**Scope:** Mobile shells connect to an operator-provided `vectis-node` URL over HTTPS (release), with explicit resolution + policy guards and no silent fallback to same-origin proxies.

Deliverables:

- Spec: `docs/specs/r7-m2-remote-pinned-node-wiring-spec.md`
- Smoke runbook: `docs/runbooks/r7-m2-remote-node-smoke-runbook.md`
- Workspace smoke: `pnpm r7:m2:remote-node:smoke`
- Client band smoke: `pnpm r7:client:readiness` (desktop check + R4 audit + web typecheck + mobile bundle)

**Proof:** `pnpm r7:m2:remote-node:smoke` (pass) and `pnpm --filter @new-start/web typecheck` (pass).

### R7-M3 — On-device sidecar (deferred, spec draft)

**Scope:** Experimental Mode B from `mobile-sidecar-policy-spec.md` — local `vectis-node` on mobile device.

- Spec: `docs/specs/r7-m3-on-device-sidecar-spec.md` (`status: draft`)
- **Not authorized for implementation** until R7-M1 iOS complete and R7-M2 field proof exists.

## Client principles (unchanged)

From [../v0/r4-client-kernel-audit.md](../v0/r4-client-kernel-audit.md):

1. No settlement logic in web or Tauri UI code.
2. Authoritative state from kernel API only (AB-15).
3. SDK remains thin HTTP + signing.

Tauri Rust code may: spawn processes, store secrets, open URLs, file dialogs — **not** replay or escrow math.

## Verification baseline

```bash
pnpm v1:build-release
pnpm r4:client-audit
pnpm dev:desktop          # after R7-D1
pnpm build:desktop        # after R7-D5
pnpm r2:exchange-drill    # against desktop data dir (after R7-D2)
```

## Gate RG-7 (new)

| Criterion | Required slices |
| --- | --- |
| Desktop dev loop works | R7-D1 |
| Sidecar node + health gate | R7-D2 |
| Marketplace-first UX | R7-D3 |
| One platform installer smoke | R7-D5 |
| R4 client audit green | R7-D3 |

Restart **v1.1 sign-off** = existing `RG-1`..`RG-4` + **`RG-7`** (desktop MVP).

Mobile (`R7-M*`) is v1.2 target.

## Sequencing

```text
R7-D1 scaffold
  → R7-D2 sidecar
  → R7-D3 marketplace UX (parallel R7-X1 discovery import)
  → R7-D4 key vault
  → R7-D5 installers
  → R7-M1 mobile (later)
```

**Next atomic step:** Continue R7-M1 with iOS scaffold on macOS host.

## Related docs

- [restart-roadmap.md](restart-roadmap.md) — phase map
- [../specs/mobile-sidecar-policy-spec.md](../specs/mobile-sidecar-policy-spec.md)
- [../foundation/platform-vision-exploration.md](../foundation/platform-vision-exploration.md)
- [../runbooks/operator-quickstart.md](../runbooks/operator-quickstart.md)
- External: [Aperio desktop.md](file:///E:/Web%20Projects/aperio/docs/app/desktop.md)
