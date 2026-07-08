# Mobile Sidecar Policy Spec

Purpose: define how the official mobile client (`R7-M*`) connects to kernel authority without re-implementing settlement logic in the app shell.

Status: `locked`

Last updated: July 2026

## Decision summary

For `R7-M2`, mobile uses **remote pinned node mode** by default.

- iOS/Android clients connect to an operator-provided `vectis-node` URL over HTTPS.
- App stores and signs keys locally (vault rules from desktop lineage apply).
- Kernel truth remains server-side (`vectis-node` replay/state authority).

`On-device node sidecar` is explicitly deferred to a later experimental slice (`R7-M3+`), not required for mobile scaffold completion.

## Why

1. **Operational reality:** mobile platforms impose process/runtime limits that make always-on local sidecars costly and brittle for early releases.
2. **Protocol integrity:** remote pinned node preserves the same authority model already proven in desktop/web (`AB-15`).
3. **Delivery speed:** enables usable mobile shell without blocking on native sidecar supervision, storage, and background policy work.

## Modes

### Mode A (required for R7-M2): Remote pinned node

- App configuration requires a pinned base URL (`https://...`).
- No settlement math in app code; only SDK signing + node API submission.
- If node unavailable, app enters read-only/offline UI states with explicit kernel-unreachable labeling.

### Mode B (deferred): On-device node sidecar

- Local `vectis-node` process on mobile device
- Requires dedicated lifecycle, storage, health, and battery/background policy spec
- Not part of `R7-M1` or `R7-M2` acceptance

## Security requirements

1. Remote URL must use HTTPS in release builds.
2. App must display connected node identity/base URL in settings.
3. Kernel-truth labels remain mandatory where state is shown.
4. Off-protocol warnings (`SOC-01`) remain visible in marketplace entry flows.

## Product constraints

- Mobile shell remains a client wrapper around existing web/SDK flows.
- No hidden fallback to embedded settlement server.
- No protocol fork between desktop and mobile behavior.

## Acceptance mapping

`R7-M1` complete when:

- Android scaffold exists and is smoke-verified.
- This policy spec is locked and linked from roadmap/runbook docs.

`R7-M2` complete when:

- Mobile app can sign and submit against a pinned remote node.
- Basic auth/onboarding/marketplace read+write flows run through remote node with truth labels.

## Related docs

- `docs/roadmap/r7-professional-client-execution-plan.md`
- `docs/runbooks/mobile-scaffold-runbook.md`
- `docs/v0/r4-client-kernel-audit.md`
