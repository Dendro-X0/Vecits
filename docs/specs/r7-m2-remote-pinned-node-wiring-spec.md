# R7-M2 — Remote pinned node wiring spec

Purpose: complete the official mobile client wiring so iOS/Android shells operate as a thin signer + UI over a **remote pinned** `vectis-node` base URL (HTTPS in release), without any settlement logic in the app shell.

Status: `locked`

Last updated: July 2026

## Scope

This slice completes **Mode A** from `docs/specs/mobile-sidecar-policy-spec.md`:

- Mobile runtime resolves a pinned node base URL.
- All API calls and event submissions use the pinned node base URL.
- Release builds enforce HTTPS pinned node URL policy.
- UX clearly communicates kernel connectivity and never falls back to hidden same-origin proxies.

Non-goals:

- On-device node sidecar (explicitly deferred to `R7-M3+`).
- Fiat rails, transferable credits, arbitration.
- Heavy UI polish loops.

## Authority model (invariants)

- **Kernel truth** remains `vectis-node`.
- Mobile app performs: key generation, signing, submission, display of kernel-backed state.
- Mobile app does **not** implement replay, escrow math, settlement logic, or any protocol fork.

## Inputs + configuration

### Runtime globals (preferred)

Provided by the Tauri shell at WebView startup:

- `globalThis.__VECTIS_MOBILE__ : boolean`
- `globalThis.__VECTIS_MOBILE_RELEASE__ : boolean`
- `globalThis.__VECTIS_MOBILE_PINNED_NODE_URL__ : string`

### Build-time fallback (allowed)

If runtime globals are absent:

- `NEXT_PUBLIC_MOBILE_PINNED_NODE_URL`
- `NEXT_PUBLIC_VECTIS_MOBILE_RELEASE`

### Local override (dev only)

When mobile runtime is enabled and **not release**, the user may store a local override:

- localStorage key: `vectis.mobile.pinnedNodeUrlOverride`

Release builds must not permit override editing.

## Resolution order

Mobile runtime resolution (browser/WebView code):

1. `vectis.mobile.pinnedNodeUrlOverride` (non-release only)
2. `globalThis.__VECTIS_MOBILE_PINNED_NODE_URL__`
3. `NEXT_PUBLIC_MOBILE_PINNED_NODE_URL`

If mobile runtime is enabled and the resolved pinned URL is empty/invalid:

- UI must show kernel unreachable / misconfigured state.
- Exchange actions must fail fast with a clear error (no silent fallback).

## Policy rules

### Absolute URL required

Mobile pinned node must be an absolute URL (no same-origin paths like `/api/node`).

### Release HTTPS requirement

If `__VECTIS_MOBILE_RELEASE__` is true OR `NEXT_PUBLIC_VECTIS_MOBILE_RELEASE=1`:

- pinned node URL must be `https://...`
- UI should show a clear “policy satisfied / violated” status in Settings.

## UX requirements

- Settings shows:
  - connected node base URL
  - source label (runtime/env/local override)
  - release policy status (HTTPS satisfied / violated)
- When the node is unreachable:
  - show a clear failure message on submit actions (identity create, order start, milestone fund/deliver/accept)
  - do not retry in tight loops; rely on user-triggered actions/refresh

## Acceptance gates (Phase 1 exit)

### A1 — Base URL resolution correctness

On mobile runtime:

- resolution uses the order above
- source label matches the actual source
- `validateMobilePinnedNodeUrl()` rejects `/api/node` and invalid URLs

### A2 — Identity create submits to pinned node

On mobile runtime with a valid pinned URL:

- `RegisterForm` submits `IdentityCreate` to the pinned node (no `127.0.0.1` fallback)
- session persists in browser storage as today (desktop vault remains desktop-only)

### A3 — Marketplace write actions submit to pinned node

With an active session:

- Start exchange submits `ServiceOrder` to pinned node
- Order page can submit:
  - escrow fund
  - delivery
  - accept

### A4 — Release guard enforced

With release flag enabled:

- non-HTTPS pinned URL fails validation and is surfaced in Settings
- override editing UI is hidden/disabled

## Implementation map (current repo)

- Node URL resolution: `apps/web/lib/node-client-base-url.ts`
- Settings display/override: `apps/web/components/dashboard/dashboard-settings-panel.tsx`
- Identity create submission: `apps/web/components/auth/register-form.tsx`
- Marketplace submission panels:
  - `apps/web/components/marketplace/start-exchange-panel.tsx`
  - `apps/web/components/marketplace/order-exchange-panel.tsx`
- Mobile env injection: `apps/desktop/src-tauri/src/lib.rs`
- Android wrapper env injection: `scripts/r7-mobile-android-command.mjs`

