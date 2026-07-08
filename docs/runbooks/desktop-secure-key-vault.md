# Desktop secure key vault (R7-D4)

The Vectis desktop client stores Ed25519 identity keys in an encrypted local vault. The web/PWA client continues to use browser `localStorage` / passkey vault paths unchanged.

## Storage layout

| Artifact | Location | Purpose |
| --- | --- | --- |
| Encrypted vault envelope | Tauri store `identity-vault.json` | Password-protected ciphertext of `{ secretKeyHex, publicKeyHex }` |
| Device auto-unlock key | OS keychain (`vectis-desktop` / `device-unlock-key`) | Optional 32-byte key for restart auto-unlock when remember is enabled |

## Crypto

- **KDF:** PBKDF2-HMAC-SHA256, 210,000 iterations, 16-byte random salt
- **Cipher:** AES-256-GCM, 12-byte random IV
- **Encoding:** base64url (no padding) for salts, IVs, and ciphertext

These parameters match the portable backup format in `apps/web/lib/auth/key-backup.ts` (`vectis-key-backup` v1).

## Desktop vault envelope (`vectis-desktop-vault` v1)

```json
{
  "format": "vectis-desktop-vault",
  "version": 1,
  "publicKeyHex": "<64-hex>",
  "passwordKdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 210000, "salt": "<b64url>" },
  "passwordCipher": { "name": "AES-GCM", "iv": "<b64url>", "ciphertext": "<b64url>" },
  "deviceCipher": { "name": "AES-GCM", "iv": "<b64url>", "ciphertext": "<b64url>" },
  "rememberEnabled": true
}
```

`deviceCipher` is omitted when remember is disabled.

## Portable backup export (`.vectis-key.json`)

Export from **Settings → Encrypted key backup** uses the shared `vectis-key-backup` v1 document. Desktop export invokes `desktop_vault_export` so ciphertext matches the web backup format exactly.

## Round-trip proof checklist

1. `pnpm dev:desktop` — register or sign in with **Remember in encrypted desktop vault** and an 8+ character vault password.
2. Quit and relaunch the app — identity should auto-unlock (OS keychain path) or unlock with vault password.
3. **Settings → Encrypted key backup → Download backup file** with a separate export password.
4. **Remove desktop vault** in Settings → Advanced, then import the backup file on sign-in.
5. Confirm marketplace signing works after import.

## Tauri commands

| Command | Description |
| --- | --- |
| `desktop_vault_status` | Vault exists / unlocked / remember flags |
| `desktop_vault_try_auto_unlock` | Device keychain auto-unlock |
| `desktop_vault_unlock` | Password unlock |
| `desktop_vault_save` | Create or replace vault |
| `desktop_vault_lock` | Clear in-memory session (sign out) |
| `desktop_vault_clear` | Delete vault + device key |
| `desktop_vault_export` | Portable backup JSON |
| `desktop_vault_import` | Restore backup into vault |

## Web fallback

When `__VECTIS_DESKTOP__` is not set, session persistence uses the existing browser storage and passkey vault panels only.
