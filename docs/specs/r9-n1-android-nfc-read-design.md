# R9-N1 — Android NFC read (design)

Status: `implemented` (July 2026)

Gate: **R9-G1**

Spec: [r9-offline-transport-spec.md](r9-offline-transport-spec.md) §4

## Decision

| Concern | Choice |
| --- | --- |
| Payload | Identical R8 Tier 1 `vectis.transport.v1` JSON |
| Encoding (locked) | Prefer MIME `application/vnd.vectis.transport.v1+json`; also accept NDEF **Text** (UTF-8) containing the same JSON |
| Native bridge | Official `tauri-plugin-nfc` / `@tauri-apps/plugin-nfc` (Android first) |
| UX | Import → **Scan NFC** → same review UI as paste/QR |
| Write | Out of scope (R9-N2) |
| iOS | Read path may work if capability present; Help notes QR/paste as primary fallback. No iOS write gate. |

## Flow

```text
isAvailable() → scan({ type: "ndef" }) → decode records → parseTransportBundleInput / join URL → review
```

## Surfaces

| Layer | Path |
| --- | --- |
| Decode (pure) | `apps/web/lib/transport/nfc-payload.ts` |
| Scan wrapper | `apps/web/lib/transport/nfc-scan.ts` |
| UI | `TransportNfcScanner` on `/dashboard/import` |
| Native | `apps/desktop/src-tauri` + Android capability `nfc:default` |

## Proof

```bash
pnpm r9:nfc:read-unit
cd apps/web && pnpm typecheck
npm run r8:transport:smoke
```

Device: Android APK + tag/phone with NDEF text or MIME JSON (see runbook).
