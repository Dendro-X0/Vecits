# R8 — Convenience Transport Execution Plan

Purpose: ship **QR, deep links, and offline-friendly handoff UX** so founding operators can coordinate in person without typing URLs — while kernel authority and signing invariants stay intact.

Status: `complete` (R8-D shipped July 2026)

Kickoff: July 2026

Last updated: July 2026

Spec: [../specs/r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md)

## Context

### Why now

- Phase 1–3 client work is complete; automated gates pass.
- R6-PD-C human counterparty proof is blocked by **social trust recruitment**, not protocol bugs.
- Offline lane templates (`physical-handoff`, `local-resource-exchange`) are fixture-proven but lack production UX.
- Deep links and builder handoff already exist — R8 adds **display/scan transport** and structured bundles.

### What exists (do not rebuild)

- `buildBuilderHref` / `buildDisputeBuilderHref` — [../../apps/web/lib/dashboard/builder-handoff.ts](../../apps/web/lib/dashboard/builder-handoff.ts)
- Discovery draft import CTA — `?step=offer&import=discovery`
- Trust bootstrap vouch copy helper — Overview panel
- Physical-handoff kernel evidence — SCN-18, `npm run r6:offline-lanes:smoke`
- R7-M2 mobile pinned node wiring — `npm run r7:mobile:readiness`

## Decision

| Choice | Decision |
| --- | --- |
| Authority | **`vectis-node` replay only** — QR never settles |
| Tier sequencing | **0 → 1 → 2** — each tier shippable alone |
| Protocol changes | **None required** for Tier 0–1 |
| Mobile priority | Tier 1 scan on **R7-M2** before R7-M3 sidecar |
| Offline lanes | Tier 2 stays **experimental** — no deployment gate promotion |

## Track overview

```text
R8-A  Spec lock + doc index          ✓
R8-B  Tier 0 — QR display (web)     ✓
R8-C  Tier 1 — bundles + mobile scan ✓
R8-D  Tier 2 — offline lane wizard  ✓
```

| Phase | ID | Goal | Gate |
| --- | --- | --- | --- |
| **Planning** | R8-A | Spec + roadmap indexed | `R8-G0` ✓ |
| **Web transport** | R8-B | QR/display on key surfaces | `R8-G1` ✓ |
| **Signed intents** | R8-C | Bundle parse + mobile scanner | `R8-G2` ✓, `R8-G3` ✓ |
| **Offline lanes** | R8-D | Physical-handoff guided UX | `R8-G4` ✓ |

## Slices

### R8-A — Spec lock and documentation

**Scope:** Planning artifacts only (no client code).

| Deliverable | Acceptance |
| --- | --- |
| [../specs/r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md) | Tier model, payloads, security copy, gates |
| This execution plan | Slices R8-A..D defined |
| Roadmap index updates | `restart-roadmap.md`, `protocol-priority-backlog.md`, `docs/README.md`, `START-HERE.md` |
| Solo + low-trust playbooks | [../client/testing-without-users.md](../client/testing-without-users.md) §15 |

**Proof:** docs indexed; no implementation claims.

### R8-B — Tier 0 QR display (web)

**Scope:** Generate QR codes from existing hrefs — display and copy, no scanner yet.

**Status:** complete (July 2026)

| Surface | Href source | Component |
| --- | --- | --- |
| Trust bootstrap | Vouch request text | `transport-qr-panel.tsx` |
| Order hub | `buildBuilderHref(...)` | Resume-on-device share |
| Discovery import | `DiscoveryDraftImportCta` href | Share import link |
| Settings → Connection | Pinned node URL | Join node QR |

| Deliverable | Acceptance |
| --- | --- |
| Shared QR primitive | `apps/web/components/transport/transport-qr-panel.tsx` |
| ≥3 wired surfaces | Trust, order hub, discovery, settings |
| Kernel-truth copy | `apps/web/lib/transport/copy.ts` |
| Audit | `r4:client-audit` R8-B checks |

**Proof:** `pnpm typecheck`, `npm run r4:client-audit` pass.

### R8-C — Tier 1 bundles + mobile scan

**Scope:** Parse `vectis.transport.v1` bundles; mobile scanner in R7 shell.

**Status:** complete (July 2026)

| Deliverable | Acceptance |
| --- | --- |
| `lib/transport/bundle.ts` | Parse, validate TTL, type dispatch, builders |
| `lib/transport/bundle-actions.ts` | Route/review actions per bundle type |
| Import UI | `/dashboard/import` — paste, file upload, camera scan |
| Share UI | Tier 1 bundle QR on trust bootstrap, order hub, settings profile |
| Expiry + warnings | Mandatory copy from spec §3 Tier 1 |
| Smoke | `npm run r8:transport:smoke`, `npm run r4:client-audit` |

**Proof:** `pnpm typecheck`, `npm run r4:client-audit`, `npm run r8:transport:smoke` pass.

### R8-D — Tier 2 offline lane wizard (stretch)

**Scope:** Guided UX for `physical-handoff` dual-ack; deferred submit queue.

**Status:** complete (July 2026)

| Deliverable | Acceptance |
| --- | --- |
| Handoff wizard | `/dashboard/handoff` — order pick → ack hashes → review → sign/submit |
| Deferred queue | `handoff-queue.ts` + `HandoffQueuePanel` |
| Order hub link | Physical-handoff orders link to wizard |
| Experimental badge | Prominent on wizard |
| Regression | `npm run r6:offline-lanes:smoke`, `npm run r8:transport:smoke` |

**Proof:** `pnpm typecheck`, `npm run r4:client-audit` pass.

## Dependencies

| Dependency | Status | Notes |
| --- | --- | --- |
| R7-M2 mobile pinned node | complete | Scan host |
| R7-M1 iOS scaffold | in progress | iOS scan parity after macOS host |
| R6-L3 offline lane smoke | complete | Tier 2 regression |
| R6-PD-C field proof | blocked (social) | R8 reduces friction when counterparty appears |
| Protocol envelope changes | not required | Tier 0–1 |

## Non-goals (R8)

- New event kinds for QR transport
- Fiat payment QR (Venmo-style)
- Federation QR mesh
- R7-M3 on-device sidecar requirement
- Promoting offline lanes to community deployment gates

## Verification commands

```bash
pnpm typecheck
npm run r4:client-audit
npm run r7:mobile:readiness
npm run r6:offline-lanes:smoke   # Tier 2 only
npm run r8:transport:smoke
```

## Sequencing relative to other tracks

| Parallel track | Relationship |
| --- | --- |
| R6-PD-C human counterparty | R8-C lowers onboarding friction when volunteer appears |
| R7-M1 iOS | R8-C scanner extends to iOS after scaffold |
| Frontend Phase 4+ | R8 convenience band complete (not a protocol phase) |
| Protocol backlog P4 (`OrderAmend`) | Independent — no overlap |

## Next action

**R8 complete** — convenience transport track (Tier 0–2) shipped.

**Next:** R6-PD-C field proof when a counterparty is available, or R7-M1 iOS scaffold.

## Related docs

- [../specs/r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md)
- [../client/testing-without-users.md](../client/testing-without-users.md)
- [r7-professional-client-execution-plan.md](r7-professional-client-execution-plan.md)
- [../runbooks/offline-lane-experimental-runbook.md](../runbooks/offline-lane-experimental-runbook.md)
