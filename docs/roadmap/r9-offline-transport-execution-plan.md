# R9 — Offline transport execution plan (NFC + LAN halo)

Purpose: ship **NFC as a Tier 1 carrier** and **LAN operator-node halos** on top of R8 + Track 4 sync, without protocol settlement changes.

Status: `active` (R9-A complete; implementation authorized for R9-N / R9-H)

Kickoff: July 2026

Last updated: July 2026

Spec: [../specs/r9-offline-transport-spec.md](../specs/r9-offline-transport-spec.md)

## Context

### Why now

- R8 complete — QR/paste/import and offline-lane wizard exist.
- Maintainer path is solo-testable; NFC and LAN halos raise in-person UX without waiting for community counterparties.
- Kernel already has pull-only peer sync (`peers.json`) — halo reconcile should not invent gossip.

### What exists (do not rebuild)

- R8 Tier 1 envelope + `/dashboard/import` — [../specs/r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md)
- R7-M2 pinned node + confirm UX
- Track 4 pull sync — [../v0/v0-track4-sync-spec.md](../v0/v0-track4-sync-spec.md)
- Offline lane guards — `npm run r6:offline-lanes:smoke`

## Decision

| Choice | Decision |
| --- | --- |
| Authority | Unchanged — `vectis-node` replay only |
| NFC payloads | **Same** as R8 Tier 1 JSON |
| Halo topology | Designated local node + pin URL (Mode A) |
| Mesh gossip | Deferred (R9-X) |
| Protocol event kinds | **None** for R9-N / R9-H |

## Track overview

```text
R9-A  Spec lock + doc index
R9-N1 Android NFC read (Tier 1)
R9-N2 Android NFC write + fallback
R9-H1 Halo join UX (pin LAN node)
R9-H2 Two-node pull reconcile smoke
R9-G  Gates R9-G0..G5
```

| Phase | ID | Goal | Gate |
| --- | --- | --- | --- |
| Planning | R9-A | Spec + this plan indexed | R9-G0 |
| NFC | R9-N1 | Read NDEF → import review | R9-G1 **pass** |
| NFC | R9-N2 | Write vouch.request + QR fallback | R9-G2 **pass** |
| Halo | R9-H1 | Join/pin local node labels | R9-G3 **pass** |
| Halo | R9-H2 | peers pull smoke after LAN posts | R9-G4 **pass** |
| Closeout | R9-G | Regression smokes | R9-G5 **pass** |

## Slices

### R9-A — Spec lock and documentation

**Scope:** Planning artifacts only.

**Status:** `completed` (July 2026) — gate `R9-G0` pass.

| Deliverable | Acceptance |
| --- | --- |
| [../specs/r9-offline-transport-spec.md](../specs/r9-offline-transport-spec.md) | NFC + halo decisions, non-goals, gates — **locked** |
| This execution plan | Slices R9-A..H2 defined |
| Index updates | `docs/specs/README.md`, `docs/roadmap/README.md`, `START-HERE.md`, `protocol-priority-backlog.md` |

**Proof:** docs indexed; implementation authorized for R9-N / R9-H.

### R9-N1 — Android NFC read

**Scope:** On Android Tauri/mobile shell, read NDEF payload → parse as R8 Tier 1 envelope → open existing import/review UI.

**Status:** `completed` (July 2026) — gate `R9-G1` pass (maintainer unit + wired Android path).

| Deliverable | Acceptance |
| --- | --- |
| NFC read handler | `TransportNfcScanner` → same `ingestRaw` as paste/QR |
| Invalid/expired | Same R8 parse / expired copy |
| Solo smoke | [../runbooks/r9-nfc-operator-runbook.md](../runbooks/r9-nfc-operator-runbook.md) |

**Proof:** `pnpm r9:nfc:read-unit` · `cd apps/web && pnpm typecheck` · `npm run r8:transport:smoke`. Design: [../specs/r9-n1-android-nfc-read-design.md](../specs/r9-n1-android-nfc-read-design.md).

### R9-N2 — Android NFC write + fallback

**Scope:** Write `vouch.request` (and optionally `identity.intro`) to NFC; if write unsupported, offer QR.

**Status:** `completed` (July 2026) — gate `R9-G2` pass.

| Deliverable | Acceptance |
| --- | --- |
| Write from share panels | `TransportNfcWriter` on `TransportBundleSharePanel` (trust/overview vouch, settings intro, …) |
| Fallback | QR panel always present; write errors point to QR |
| iOS note | Help `node-connection` — QR/paste primary; write not a gate |

**Proof:** `pnpm r9:nfc:write-unit` · `pnpm r9:nfc:read-unit` · typecheck · `r8:transport:smoke`. Design: [../specs/r9-n2-android-nfc-write-design.md](../specs/r9-n2-android-nfc-write-design.md).

### R9-H1 — Halo join UX

**Scope:** Client flow to pin a LAN `vectis-node` URL from QR/NFC join bundle; show local-node honesty labels.

**Status:** `completed` (July 2026) — gate `R9-G3` pass.

| Deliverable | Acceptance |
| --- | --- |
| Join confirm | Hostname/IP visible before pin (`NodeJoinConfirm`) |
| Trust bar / status | “Local operator node — not yet reconciled with upstream” on private LAN |
| Runbook | [../runbooks/r9-halo-operator-runbook.md](../runbooks/r9-halo-operator-runbook.md) client join |

**Proof:** `pnpm r9:halo:join-unit` · `cd apps/web && pnpm typecheck`. Design: [../specs/r9-h1-halo-join-ux-design.md](../specs/r9-h1-halo-join-ux-design.md).

### R9-H2 — Halo reconcile smoke

**Scope:** Automated or scripted two-node pull after events posted to halo.

**Status:** `completed` (July 2026) — gate `R9-G4` pass.

| Deliverable | Acceptance |
| --- | --- |
| `scripts/r9-halo-smoke.mjs` | Halo → upstream pull; replay/discovery hash match |
| Docs | [../runbooks/r9-halo-operator-runbook.md](../runbooks/r9-halo-operator-runbook.md) |

**Proof:** `pnpm r9:halo:smoke -- --no-build` (35 events, hash match). Reuses Track 4 / R5 two-node convergence core.

### R9-G — Regression closeout

**Scope:** Standing regressions after NFC + halo client work; confirm no kernel API break.

**Status:** `completed` (July 2026) — gate `R9-G5` pass · **R9 sign-off**.

| Deliverable | Acceptance |
| --- | --- |
| `pnpm r9:g5` | typecheck + R9 units + `r8:transport:smoke` + `r6:offline-lanes:smoke` + halo smoke |
| Docs | Spec gates G0–G5 marked pass |

**Proof (July 2026):** web typecheck; `r9:halo:join-unit`; `r9:nfc:read-unit`; `r9:nfc:write-unit`; `r8:transport:smoke`; `r6:offline-lanes:smoke` (R6-L3 passed); `r9:halo:smoke --no-build`; `cargo check -p vectis-desktop`.

## Verification (standing, after implementation)

```bash
pnpm r9:g5 -- --no-build
# or individually:
pnpm typecheck
pnpm r9:halo:join-unit
pnpm r9:nfc:read-unit
pnpm r9:nfc:write-unit
npm run r8:transport:smoke
npm run r6:offline-lanes:smoke
pnpm r9:halo:smoke -- --no-build
```

## Explicit deferrals

- Phone mesh gossip
- Offline mint / cross-partition escrow merge
- Production promotion of offline economic lanes
- iOS NFC write as a gate (nice-to-have only)

## Related

- Spec: [../specs/r9-offline-transport-spec.md](../specs/r9-offline-transport-spec.md)
- R8: [r8-convenience-transport-execution-plan.md](r8-convenience-transport-execution-plan.md)
- Sync: [../v0/v0-track4-sync-spec.md](../v0/v0-track4-sync-spec.md)
