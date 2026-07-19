# R9-H1 — Halo join UX (design)

Status: `implemented` (July 2026)

Gate: **R9-G3**

Spec: [r9-offline-transport-spec.md](r9-offline-transport-spec.md) §5.2–5.3

## Decision

Reuse R7-M2 pin storage (`vectis.mobile.pinnedNodeUrlOverride`) and R8 import/QR. No new transport bundle type — market join QR remains an absolute node URL (Settings → Join this node).

| Concern | Choice |
| --- | --- |
| Join payload | Absolute `http(s)://host:port` (existing QR) |
| Confirm | Show protocol + **hostname/IP** + port before `writeMobilePinnedNodeOverride` |
| LAN detect | RFC1918, localhost, `.local`, IPv6 ULA/link-local |
| Trust bar | When private/local host: honesty line from §5.3 |
| Sync | Out of scope (R9-H2) |

## Surfaces

1. Import / scan — bare URL opens join confirm; transport review can pin `bundle.nodeUrl`
2. Settings connection — honesty when pinned to LAN; pin form with confirm (web + mobile)
3. Marketplace trust bar — “Local operator node — not yet reconciled with upstream”

## Proof

```bash
node --experimental-strip-types ./scripts/r9-h1-halo-join-unit.mjs
cd apps/web && pnpm typecheck
```
