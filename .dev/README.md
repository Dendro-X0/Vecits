# Maintainer dev config (`.dev/`)

Tracked dev tooling configuration lives here. Ephemeral files (ports, session state) may also land in this folder and stay gitignored.

| File | Purpose |
| --- | --- |
| `client.cdp.yaml` | CodaCtrl CDP profile for Vectis web surfaces |
| `web-port` | Assigned dev web port (written by `scripts/ensure-dev-web-port.mjs`) |
| `desktop-web-port` | Random desktop/Tauri dev port (written by `scripts/dev-desktop.mjs`) |
| `tauri-dev-overlay.json` | Ephemeral Tauri dev URL overlay (written by `scripts/dev-desktop.mjs`) |
