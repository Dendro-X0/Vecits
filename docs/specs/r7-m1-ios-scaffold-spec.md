# R7-M1 — iOS scaffold spec

Purpose: define the minimal iOS Tauri scaffold for the official Vectis client, mirroring the Android scaffold and sharing the existing `apps/desktop` shell.

Status: `draft`

Last updated: July 2026

## Scope

- Initialize a Tauri iOS project under `apps/desktop/src-tauri/gen/ios` on a macOS host.
- Ensure the iOS target wraps the same `apps/web` UI and uses the same mobile sidecar policy (remote pinned node).
- Keep this slice strictly to scaffold + wiring; no App Store distribution work.

Non-goals:

- iOS background process policy for a local node sidecar.
- App Store metadata, signing certificates, or release workflows.
- Any divergence in protocol behavior between Android and iOS.

## Target layout

Generated (or maintained) paths on macOS:

- `apps/desktop/src-tauri/gen/ios/Runner.xcodeproj`
- `apps/desktop/src-tauri/gen/ios/Runner/Info.plist`
- `apps/desktop/src-tauri/gen/ios/Runner/AppDelegate.swift` (or SwiftUI equivalent)

Exact structure may differ per Tauri v2 generator, but the runbook should reference the concrete paths produced by `tauri ios init`.

## Commands (macOS host)

From workspace root on macOS:

```bash
# One-time init (idempotent once created)
pnpm --filter @vectis/desktop exec tauri ios init

# Dev loop (requires iOS simulator or device)
pnpm --filter @vectis/desktop exec tauri ios dev

# Build (debug or release binary)
pnpm --filter @vectis/desktop exec tauri ios build
```

## Policy alignment

- iOS builds must inject the same runtime globals as Android via the Tauri layer:
  - `__VECTIS_MOBILE__`
  - `__VECTIS_MOBILE_RELEASE__`
  - `__VECTIS_MOBILE_PINNED_NODE_URL__`
- Remote pinned node policy from `docs/specs/mobile-sidecar-policy-spec.md` applies unchanged.

Dev/build commands for iOS must inject pinned node + release flags via workspace environment variables:

- `VECTIS_MOBILE_PINNED_NODE_URL`
- `VECTIS_MOBILE_RELEASE` (and `NEXT_PUBLIC_VECTIS_MOBILE_RELEASE`)
- `NEXT_PUBLIC_MOBILE_PINNED_NODE_URL`

## Acceptance criteria (R7-M1 iOS slice)

On a macOS host:

1. `tauri ios init` has been run for `@vectis/desktop`, producing a stable `gen/ios` scaffold in the repo.
2. `tauri ios dev` launches an iOS simulator/device that loads the `apps/web` UI.
3. The mobile runtime globals are present in the iOS WebView, and `resolveNodeConnectionInfo()` reports `isMobileRuntime: true`.
4. No settlement logic is introduced in iOS-specific code; all kernel truth remains in `vectis-node` via the SDK.

## Related docs

- `docs/roadmap/r7-professional-client-execution-plan.md`
- `docs/runbooks/mobile-scaffold-runbook.md`
- `docs/specs/mobile-sidecar-policy-spec.md`

