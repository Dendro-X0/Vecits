# R9 NFC operator runbook (Android read + write)

Purpose: carry R8 Tier 1 `vectis.transport.v1` JSON over NFC into the same import review UI as paste/QR, and write tags from share panels.

Status: `active` (R9-N1 read + R9-N2 write shipped)

Last updated: July 2026

Design: [../specs/r9-n1-android-nfc-read-design.md](../specs/r9-n1-android-nfc-read-design.md) · [../specs/r9-n2-android-nfc-write-design.md](../specs/r9-n2-android-nfc-write-design.md)

## Encoding (locked)

| Form | Value |
| --- | --- |
| Preferred (read + write) | NDEF MIME `application/vnd.vectis.transport.v1+json` with UTF-8 JSON body |
| Accepted on read | NDEF Text (UTF-8) whose body is the same JSON |
| Also accepted on read | Absolute `http(s)` node join URL (halo pin) |

Never put secret keys on a tag.

## Maintainer units (no device)

```bash
pnpm r9:nfc:read-unit
pnpm r9:nfc:write-unit
npm run r8:transport:smoke
```

## Android device smoke — write then read (solo)

1. Build/run Android shell: `pnpm --filter @vectis/desktop android:dev` (or release APK).
2. Sign in → Dashboard → Overview (trust bootstrap) or Settings identity share.
3. Open **Share vouch request (bundle)** / identity intro share → **Write to NFC tag** → hold a writable tag.
4. If write fails or NFC is off: use the **QR** on the same panel (fallback always present).
5. On a second device (or same): Import → **Scan NFC** → expect the same review card as paste.
6. Invalid/expired → same errors as R8.

## Honesty / platforms

- Tapping / writing does not publish offers or move credits.
- Confirm node URL before connecting / pinning.
- **iOS:** prefer QR or paste. NFC read may work when the OS allows it; **NFC write is not a product gate** — use QR when write is denied or unavailable.
- Android: primary path for tap write + read.

## Related

- [r9-offline-transport-spec.md](../specs/r9-offline-transport-spec.md)
- [r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md)
- [r9-halo-operator-runbook.md](r9-halo-operator-runbook.md)
