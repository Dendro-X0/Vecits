# R9 NFC operator runbook (Android read + write)

Purpose: carry R8 Tier 1 `vectis.transport.v1` JSON over NFC into the same import review UI as paste/QR, and write tags from share panels.

Status: `active` (R9-N1 read + R9-N2 write shipped; **device smoke optional / hardware-gated**)

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

Claim when green: encoding + UI contract helpers. **Not** a physical tag proof.

## Hardware prerequisites (device smoke)

| Need | Notes |
| --- | --- |
| Android phone/tablet with NFC | USB debugging optional but useful (`adb devices`) |
| Writable NFC tag | NTAG213/215/216 or similar; blank or rewritable |
| Official Android shell | `pnpm r7:mobile:android:dev` or installed APK |
| Reachable node URL | Local/LAN/Tailscale pin the app will confirm before connect |

Without those, stop after maintainer units. Do not claim device smoke.

## Android device smoke — write then read (solo)

Print or copy this checklist; check each box only with a real tag + device.

### Prep

- [ ] NFC enabled in Android settings
- [ ] App installed / `pnpm r7:mobile:android:dev` running on device
- [ ] Signed in; node pin set (or ready to confirm on import)
- [ ] Writable tag in hand; QR fallback visible on the same share panel

### Write (R9-N2)

1. Sign in → Dashboard → Overview (trust bootstrap) or Settings identity share.
2. Open **Share vouch request (bundle)** / identity intro share.
3. Tap **Write to NFC tag** → hold the writable tag until success.
4. If write fails or NFC is off: use the **QR** on the same panel (fallback always present) — still a pass for “QR fallback works,” fail for “NFC write works.”

- [ ] Write succeeded (or explicit fail + QR used)
- [ ] No secret key material shown on the tag path

### Read (R9-N1)

5. On a second device (or same): Import → **Scan NFC** → hold the written tag.
6. Expect the **same review card** as paste/QR for that bundle type.
7. Invalid/expired tag or JSON → same errors as R8 (expired / regenerate).

- [ ] Review card matches paste path
- [ ] Honesty copy visible: tapping does not publish / confirm node URL
- [ ] Confirm/cancel still required before pin or vault sign

### Evidence to keep (optional)

Save under `target/tmp/r9-nfc-device-<date>/` if you want a trail:

- Device model + Android version (text note)
- Bundle type used (`vouch.request` / `identity.intro` / …)
- Pass/fail for write, read, QR fallback
- Screenshot of import review (no secrets)

### Claim language

| Allowed | Forbidden |
| --- | --- |
| “Android NFC write/read smoke passed on \<device\>” | “Field proof with counterparty” (unless a second human actually participated) |
| “QR fallback used when NFC write denied” | “Settlement over NFC” |

## Honesty / platforms

- Tapping / writing does not publish offers or move credits.
- Confirm node URL before connecting / pinning.
- **iOS:** prefer QR or paste. NFC read may work when the OS allows it; **NFC write is not a product gate** — use QR when write is denied or unavailable.
- Android: primary path for tap write + read.

## Related

- [r9-offline-transport-spec.md](../specs/r9-offline-transport-spec.md)
- [r8-convenience-transport-spec.md](../specs/r8-convenience-transport-spec.md)
- [r9-halo-operator-runbook.md](r9-halo-operator-runbook.md)
- [stability-regression-pack.md](stability-regression-pack.md) — day-to-day pack (no device NFC)

← [Runbooks](README.md) · [Docs index](../index.md)
