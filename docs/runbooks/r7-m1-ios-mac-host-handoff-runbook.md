# R7-M1 — iOS macOS Host Handoff Runbook

Purpose: complete the iOS half of R7-M1 on a **macOS machine** after Android scaffold and R7-M2 wiring are done on Windows/Linux.

Status: `active` (handoff — **blocked without macOS**)

Last updated: July 2026

> **Maintainer note (July 2026):** Solo Windows host — iOS scaffold is **deferred**. Keep this runbook for when a macOS machine is available; do not treat R7-M1 as incomplete for Android. Android half is done.

## Prerequisites (macOS host)

- macOS with Xcode + iOS toolchain installed
- Rust toolchain + Tauri mobile prerequisites per [Tauri v2 iOS docs](https://v2.tauri.app/start/prerequisites/)
- Node.js + pnpm (repo uses `pnpm@9`)
- Repo cloned at same commit as Windows work (or pull latest)

Windows/Linux hosts cannot run `tauri ios init` — this runbook is the handoff bridge.

## Pre-flight on any host

Before switching to macOS, confirm Windows-side work is green:

```bash
pnpm r7:client:readiness
```

Expected: desktop cargo check, R4 audit, web typecheck, and mobile readiness all pass.

## Step 1 — Initialize iOS scaffold (one-time)

From repo root on **macOS**:

```bash
pnpm r7:mobile:ios:init
```

Or directly:

```bash
pnpm --filter @vectis/desktop exec tauri ios init
```

Confirm generated tree exists:

```bash
ls apps/desktop/src-tauri/gen/ios
pnpm r7:ios:scaffold-smoke
```

**Commit** the generated `gen/ios` scaffold to the repo so CI/other macOS hosts can skip re-init.

## Step 2 — Dev loop (simulator)

Start a remote `vectis-node` reachable from the simulator, or use localhost if the node runs on the Mac:

```bash
# Default dev pinned URL: http://127.0.0.1:7878
pnpm r7:mobile:ios:dev
```

Custom pinned node:

```bash
pnpm r7:mobile:ios:dev -- --pinned-node-url http://127.0.0.1:7878
```

### In-app checks

1. App loads `apps/web` UI in simulator
2. **Settings → Kernel connection** shows:
   - Mobile runtime: enabled
   - Connected node URL matches pinned URL
   - Source: `mobile-runtime` or `mobile-env`
3. If pinned URL missing/invalid: **Kernel unreachable** notice appears (R7-M2 UX)

## Step 3 — Release build dry-run (HTTPS guard)

Verify release policy injection without shipping:

```bash
pnpm r7:mobile:ios:build -- --release --pinned-node-url https://node.example.com --dry-run
```

Expected: command prints env vars with `VECTIS_MOBILE_RELEASE=1` and HTTPS URL.

Attempting HTTP in release mode should fail fast:

```bash
pnpm r7:mobile:ios:build -- --release --pinned-node-url http://127.0.0.1:7878
# expect validation error
```

## Step 4 — End-to-end submit smoke (optional but recommended)

With a healthy pinned node:

1. Register identity (or sign in)
2. Open marketplace offer → **Start exchange**
3. Confirm write action reaches node (accepted or clear API error)

See also: [r7-m2-remote-node-smoke-runbook.md](r7-m2-remote-node-smoke-runbook.md)

## Step 5 — Close R7-M1 iOS slice

On macOS after success:

```bash
pnpm r7:ios:scaffold-smoke
pnpm r7:client:readiness
```

Update trackers:

- Mark R7-M1 iOS acceptance in `docs/roadmap/working-context-log.md`
- If iOS scaffold is committed, Android-only hosts can run `pnpm r7:mobile:readiness` and iOS smoke will run automatically when `gen/ios` exists

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Simulator cannot reach node | Pinned URL must be reachable from simulator (use Mac host IP or `127.0.0.1` if node is local) |
| Kernel unreachable in app | Settings → verify pinned URL; release builds require HTTPS |
| `tauri ios init` fails | Xcode CLI tools, Rust iOS targets, CocoaPods (if required by Tauri version) |
| WebView shows desktop sidecar | Mobile globals not injected — verify `apps/desktop/src-tauri/src/lib.rs` mobile build |

## Related docs

- [mobile-scaffold-runbook.md](mobile-scaffold-runbook.md)
- [../specs/r7-m1-ios-scaffold-spec.md](../specs/r7-m1-ios-scaffold-spec.md)
- [mobile-remote-pinned-node-operator-runbook.md](mobile-remote-pinned-node-operator-runbook.md)
- [../specs/r7-m2-remote-pinned-node-wiring-spec.md](../specs/r7-m2-remote-pinned-node-wiring-spec.md)
