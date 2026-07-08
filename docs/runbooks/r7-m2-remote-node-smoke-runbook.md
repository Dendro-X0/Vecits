# R7-M2 — Remote pinned node smoke runbook

Purpose: verify the mobile runtime uses a remote pinned `vectis-node` base URL (and enforces HTTPS in release mode).

Status: `draft` (Phase 1)

Last updated: July 2026

## Prerequisites

- A reachable `vectis-node` instance (operator-provided).
- For Android dev/build: Android SDK + emulator/device (optional on Windows; this runbook documents the steps).

## Verify the pinned node URL is visible

In the app, open **Settings → Kernel connection** and confirm:

- “Connected node” shows the pinned URL
- “Source” indicates `mobile-runtime` or `mobile-local-override`

## Dev mode (HTTP allowed)

If using the Android emulator with a node running on your host:

- default pinned URL is `http://10.0.2.2:7878`

Command:

```bash
npm run r7:mobile:android:dev
```

Optional explicit override:

```bash
npm run r7:mobile:android:dev -- --pinned-node-url http://10.0.2.2:7878
```

In Settings, if **not release**, you may set **Mobile pinned node URL override** to another absolute URL (HTTP or HTTPS).

## Release mode (HTTPS required)

Command:

```bash
npm run r7:mobile:android:build -- --release --pinned-node-url https://node.example.com
```

Expected:

- Settings shows “Mobile release policy satisfied (HTTPS pinned node).”
- The override input is not shown.

If you pass an HTTP URL in release mode, the build command should fail fast with a validation error.

## End-to-end submit smoke

With a valid pinned node URL:

1. **Register**: Generate keypair → Create account
2. Confirm Settings shows the same pinned node URL
3. Open a marketplace offer and click **Start exchange**
4. On the order page, submit at least one write action appropriate to your role:
   - buyer: **Fund escrow**
   - provider: **Deliver**
   - buyer: **Accept**

Expected:

- Each action either succeeds (accepted) or fails with a clear node/API error message.
- No action silently falls back to `127.0.0.1` or `/api/node` in mobile runtime.

## Related docs

- `docs/specs/mobile-sidecar-policy-spec.md`
- `docs/specs/r7-m2-remote-pinned-node-wiring-spec.md`
- `docs/runbooks/mobile-scaffold-runbook.md`

