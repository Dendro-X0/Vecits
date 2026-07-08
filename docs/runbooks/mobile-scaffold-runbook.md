# Mobile Scaffold Runbook (R7-M1)

Purpose: initialize and verify the first Tauri mobile scaffold for Vectis using the existing `apps/desktop` shell as the shared client host.

Status: `in_progress`

Last updated: July 2026

## Scope in this slice

- Android scaffold generation under `apps/desktop/src-tauri/gen/android`
- Workspace scripts for Android init/dev/build
- Minimal scaffold smoke check (file-level verification)

This slice does **not** ship mobile installers.

Mobile sidecar decision is now locked in [../specs/mobile-sidecar-policy-spec.md](../specs/mobile-sidecar-policy-spec.md):

- `R7-M2` default: remote pinned node
- on-device sidecar: deferred experimental track

## Commands (Android, Windows or macOS host)

```bash
# Generate Android project (idempotent once created)
npm run r7:mobile:android:init

# Verify scaffold files exist
npm run r7:mobile:scaffold-smoke

# Windows-compatible mobile readiness bundle (Android + R7-M2 wiring)
npm run r7:mobile:readiness
```

Optional local development/build (requires Android SDK + emulator/device):

```bash
npm run r7:mobile:android:dev
npm run r7:mobile:android:build
```

Android command wrappers now inject runtime policy vars:

- `VECTIS_MOBILE_PINNED_NODE_URL`
- `VECTIS_MOBILE_RELEASE`
- `NEXT_PUBLIC_MOBILE_PINNED_NODE_URL`
- `NEXT_PUBLIC_VECTIS_MOBILE_RELEASE`

Examples:

```bash
# Dev (default pinned URL http://10.0.2.2:7878)
npm run r7:mobile:android:dev

# Release guard (must be HTTPS URL)
npm run r7:mobile:android:build -- --release --pinned-node-url https://node.example.com
```

## R7-M2 pinned-node wiring baseline

Mobile runtime reads pinned node URL in this order:

1. `globalThis.__VECTIS_MOBILE_PINNED_NODE_URL__` (runtime injection)
2. `NEXT_PUBLIC_MOBILE_PINNED_NODE_URL` (build-time fallback)

Release policy guard:

- set `NEXT_PUBLIC_VECTIS_MOBILE_RELEASE=1` for release builds
- when enabled, non-HTTPS or same-origin path base URLs are rejected in form validation

Settings UI now shows connected kernel URL/source and mobile release policy status.

## Generated Android project

Primary paths:

- `apps/desktop/src-tauri/gen/android/app/build.gradle.kts`
- `apps/desktop/src-tauri/gen/android/app/src/main/AndroidManifest.xml`
- `apps/desktop/src-tauri/gen/android/app/src/main/java/com/vectis/desktop/MainActivity.kt`

## iOS scaffold (macOS host)

The iOS scaffold must be initialized from a macOS host with Xcode and the iOS toolchain installed.

On macOS:

```bash
# Generate iOS project (one-time init)
npm run r7:mobile:ios:init

## Dev loop (requires iOS simulator/device)
npm run r7:mobile:ios:dev

## Build (debug or release binary)
npm run r7:mobile:ios:build

# Release guard example (must be HTTPS pinned node URL)
npm run r7:mobile:ios:build -- --release --pinned-node-url https://node.example.com
```

After initialization, confirm the generated project exists under:

- `apps/desktop/src-tauri/gen/ios/`

Refer to `docs/specs/r7-m1-ios-scaffold-spec.md` for iOS acceptance criteria.

**macOS handoff:** when moving from Windows/Linux, follow [r7-m1-ios-mac-host-handoff-runbook.md](r7-m1-ios-mac-host-handoff-runbook.md).

Optionally verify scaffold file-level presence:

```bash
npm run r7:ios:scaffold-smoke
```

## Notes

- On Windows, only the Android scaffold/commands are expected to run.
- Settlement authority remains kernel/node; mobile scaffolds only prepare the host shell/runtime.

## Related docs

- `docs/roadmap/r7-professional-client-execution-plan.md`
- `docs/roadmap/restart-roadmap.md`
