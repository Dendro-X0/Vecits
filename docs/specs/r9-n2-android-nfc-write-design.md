# R9-N2 — Android NFC write + QR fallback (design)

Status: `implemented` (July 2026)

Gate: **R9-G2**

Spec: [r9-offline-transport-spec.md](r9-offline-transport-spec.md) §4 · Read: [r9-n1-android-nfc-read-design.md](r9-n1-android-nfc-read-design.md)

## Decision

| Concern | Choice |
| --- | --- |
| Payload | Same R8 Tier 1 JSON (`vouch.request`, `identity.intro`, other share bundles) |
| Encoding | Write NDEF MIME `application/vnd.vectis.transport.v1+json` (N1 preferred) |
| Native | `tauri-plugin-nfc` `write()` + capability `nfc:allow-write` |
| Surfaces | `TransportBundleSharePanel` (trust overview vouch, settings intro, order resume, …) |
| Fallback | QR panel always remains; on write deny/fail show “use QR below” |
| iOS | Honest Help: prefer QR/paste; NFC write not a gate |

## Flow

```text
Share panel → Write to NFC → hold tag → success
             ↘ unavailable / error → keep QR + copy
```

## Proof

```bash
pnpm r9:nfc:write-unit
pnpm r9:nfc:read-unit
cd apps/web && pnpm typecheck
npm run r8:transport:smoke
cargo check -p vectis-desktop
```
