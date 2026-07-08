# R7-M3 — On-device node sidecar spec (experimental, deferred)

Purpose: define the **experimental** mobile path where `vectis-node` runs on-device (Mode B from `mobile-sidecar-policy-spec.md`), mirroring desktop sidecar supervision without forking protocol behavior.

Status: `draft` (deferred — do not implement until R7-M1 iOS scaffold + R7-M2 remote pinned node are stable in the field)

Last updated: July 2026

## Decision

**Default mobile mode remains remote pinned node (R7-M2).** R7-M3 is an optional experimental track for offline-first or self-hosted operator scenarios on mobile hardware.

Implement R7-M3 only when:

1. R7-M1 iOS scaffold is complete on macOS host.
2. R7-M2 remote pinned node flows are proven with at least one operator deployment.
3. Platform lifecycle constraints below have explicit acceptance tests.

## Scope (when implemented)

- Spawn and supervise `vectis-node` from Tauri mobile shell (Android/iOS).
- Bind loopback (`127.0.0.1:<port>`) and inject `__VECTIS_NODE_URL__` / mobile globals consistently with desktop.
- Per-app data directory under platform app storage (`vectis-data/`).
- Health gate before WebView shows marketplace flows.
- Stop sidecar on app exit; define background/ suspend behavior per platform.

## Non-goals

- Replacing remote pinned node as the default mobile mode.
- Settlement logic in Tauri or web layers (R4 audit rules stand).
- App Store / Play Store release policy for experimental builds (separate track).
- Federation or multi-node sync UX on mobile.

## Reference implementation (desktop)

Desktop sidecar behavior in `apps/desktop/src-tauri/src/node_sidecar.rs`:

- Resolve bundled or PATH `vectis-node` binary
- `node init --data-dir` on first launch
- `node serve --bind 127.0.0.1:7878`
- Health poll before showing UI
- Kill child on app exit

Mobile R7-M3 should reuse this logic via shared Rust module where possible (`#[cfg(mobile)]` adaptations).

## Platform constraints

### Android

- Foreground service may be required for long-running node process when app is backgrounded.
- Battery optimization exemptions are operator/user configuration — document, do not auto-request aggressively.
- Emulator dev: loopback same as desktop (`127.0.0.1:7878`).

### iOS

- Background execution is severely limited; on-device sidecar likely **foreground-only** for v1 experimental band.
- App suspend must not corrupt SQLite event log — rely on kernel graceful shutdown or read-only mode when suspended.
- TestFlight / sideload distribution only until policy is proven.

## Mode selection (future)

| Mode | When | Node URL source |
| --- | --- | --- |
| Remote pinned (R7-M2) | Default production | `__VECTIS_MOBILE_PINNED_NODE_URL__` |
| On-device sidecar (R7-M3) | Experimental opt-in | `http://127.0.0.1:7878` via sidecar state |

Settings must show active mode explicitly. No silent fallback from remote → local or local → remote.

## Security requirements

1. Sidecar binds loopback only (not `0.0.0.0`) unless explicitly documented for dev.
2. Data dir stays in app sandbox.
3. Kernel-truth labels and SOC-01 warnings unchanged.
4. Release builds must not expose unauthenticated admin endpoints beyond existing node API surface.

## Acceptance gates (R7-M3 exit — future)

### M3-A — Sidecar lifecycle

- Cold start → health green → marketplace load without manual CLI.
- App exit → sidecar process stopped (no orphan on Android emulator smoke).

### M3-B — Protocol parity

- One full exchange (identity → offer → order → fund → deliver → accept) against on-device node matches desktop sidecar drill outcomes.

### M3-C — Mode clarity

- Settings shows **on-device sidecar** mode and loopback URL.
- Switching to remote pinned mode (R7-M2) does not require reinstall.

## Verification plan (future)

```bash
pnpm r7:mobile:readiness          # regression guard for R7-M2
# TBD: pnpm r7:m3:sidecar:smoke   # new script when implemented
```

## Related docs

- [mobile-sidecar-policy-spec.md](mobile-sidecar-policy-spec.md)
- [r7-m2-remote-pinned-node-wiring-spec.md](r7-m2-remote-pinned-node-wiring-spec.md)
- [../runbooks/mobile-scaffold-runbook.md](../runbooks/mobile-scaffold-runbook.md)
- [../roadmap/r7-professional-client-execution-plan.md](../roadmap/r7-professional-client-execution-plan.md)
