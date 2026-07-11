# Desktop release build (R7-D5)

Produces platform installers with the Vectis web shell, encrypted vault commands, and a bundled `vectis-node` sidecar.

## Quick start (Windows)

```bash
npm run build:desktop
npm run r7:desktop:release-smoke
```

Artifacts:

| Output | Path |
| --- | --- |
| NSIS installer (Windows) | `target/release/bundle/nsis/*.exe` |
| DMG (macOS) | `target/release/bundle/dmg/*.dmg` |
| Debian package (Linux) | `target/release/bundle/deb/*.deb` |
| Build manifest | `dist/desktop/desktop-build-manifest.json` |
| Staged sidecar | `apps/desktop/src-tauri/binaries/vectis-node-<triple>` |

Override bundle target:

```bash
TAURI_BUNDLE_TARGET=deb npm run build:desktop
```

## Pipeline

`scripts/build-desktop.mjs` runs in order:

1. `npm run v1:build-release` — release `vectis-node` binary
2. Stage sidecar into `src-tauri/binaries/` for `externalBin`
3. Generate icons (`pnpm brand:icons`) when missing
4. `TAURI_BUILD=1 pnpm --filter @new-start/web build:desktop` — static export to `apps/web/out`
5. `tauri build --bundles <platform>` — installer

Resume after a partial build:

```bash
node ./scripts/build-desktop.mjs --tauri-only
```

Requires ~10 GB free disk for the release Tauri compile on Windows.

## Size budget notes

| Component | Typical size | Notes |
| --- | --- | --- |
| `vectis-node` sidecar | ~8–15 MB | Single release binary, not the full dev toolchain |
| Web static export | ~2–8 MB | Next static assets in `apps/web/out` |
| Tauri runtime + WebView | ~15–40 MB | Platform-dependent |
| **Installer total** | **~30–70 MB** | Measure after `build:desktop` on your target OS |

Record actual sizes from `r7:desktop:release-smoke` output when cutting a release.

## Post-install smoke

1. Install the NSIS/DMG/deb artifact.
2. Launch Vectis — window appears after `GET /health` succeeds.
3. Register or unlock the desktop vault.
4. Open marketplace — listings or showcase previews load from the local node.
5. Optional: run `npm run r2:exchange-drill` against the desktop data dir (`%APPDATA%/com.vectis.desktop/vectis-data` on Windows).

## macOS / Linux CI

Build on the target OS (or CI matrix job). Cross-compiling DMG/deb from Windows is not supported by the default script.

Tag releases and manual workflow runs build installers via [release-packaging-ci.md](release-packaging-ci.md) (`desktop-windows`, `desktop-macos`, `desktop-linux` artifacts).

## Static export constraints

Desktop builds set `TAURI_BUILD=1`, enabling `output: "export"` in `apps/web/next.config.ts`. The legacy `/operator` console is replaced by a stub in desktop bundles; use **Settings → Advanced** or the web deployment for the full operator surface.
