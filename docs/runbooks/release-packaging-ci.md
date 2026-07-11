# Release packaging CI

Purpose: document how GitHub Actions builds **multi-platform, self-hosted** Vectis artifacts — kernel, Docker, static web shell, and desktop installers.

Last updated: July 2026

## Workflows

| Workflow | Trigger | Role |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | PR + push to `main` | Fast readiness gates (typecheck, audits, smokes, Tauri cargo check) |
| [`.github/workflows/release-build.yml`](../../.github/workflows/release-build.yml) | `v*` tags + manual dispatch | Multi-platform packaging artifacts |

Local equivalent before push:

```bash
npm run ci:readiness
npm run v1:docker-smoke
```

Tag release (builds all packaging jobs):

```bash
git tag v0.1.0
git push origin v0.1.0
```

**Where files appear:** successful tag builds publish a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) with attached binaries. If a release job fails, kernel/docker artifacts may still exist under **Actions → workflow run → Artifacts** (90-day retention).

**Re-run after a failed build:** push fixes to `main`, move the tag, and push again:

```bash
git tag -f v0.1.0
git push origin main
git push origin v0.1.0 --force
```

Only force-move tags when you intend to replace a broken release artifact set.

Manual release (optional desktop/Android toggles):

GitHub → Actions → **Release Build** → **Run workflow**

## Release artifacts

| Artifact | Platforms | Self-hosted use |
| --- | --- | --- |
| `kernel-*` | Linux x64, Windows x64, macOS arm64/x64 | Run `vectis-node serve` directly |
| `docker-image` | Linux container | `docker load` + compose/systemd |
| `web-static` | OS-agnostic static files | nginx/Caddy in front of node API |
| `desktop-*` | Windows NSIS, macOS DMG, Linux deb | All-in-one installer with bundled sidecar |
| `android-apk` | Android (manual dispatch only) | Remote pinned node mobile client |

After a workflow completes, download artifacts from the run summary page.

## Self-hosted deployment paths

### Path A — Docker (simplest server)

```bash
docker load -i vectis-node-docker.tar
docker run -d --name vectis-node -p 7878:7878 -v vectis-data:/data vectis-node:v0.1.0
curl http://127.0.0.1:7878/health
```

See [r2-persistent-deployment-runbook.md](r2-persistent-deployment-runbook.md) for production compose/systemd.

### Path B — Kernel binary + static web

1. Extract `kernel-linux-x64` (or your platform).
2. Extract `web-static` to `/var/www/vectis`.
3. Serve static files; set `NEXT_PUBLIC_NODE_API_BASE_URL` at build time or configure browser clients to your node URL.
4. Put TLS reverse proxy in front if exposing beyond localhost.

Build web shell locally:

```bash
npm run build:web-static
```

### Path C — Desktop installer (all devices with desktop OS)

Install the platform artifact from `desktop-windows`, `desktop-macos`, or `desktop-linux`. The installer bundles `vectis-node` and launches the official client shell.

See [desktop-release-build.md](desktop-release-build.md).

### Path D — Mobile (remote pinned node)

Android APK builds are **experimental** and only run on manual workflow dispatch (`include_android: true`). Production mobile deployment still follows [mobile-remote-pinned-node-operator-runbook.md](mobile-remote-pinned-node-operator-runbook.md).

## CI tiers

| Tier | Command / workflow | Duration | When |
| --- | --- | --- | --- |
| T0 | `npm run ci:readiness` | ~5–15 min | Every PR / before push |
| T1 | `npm run v1:docker-smoke` | ~5 min | PR CI + local before release |
| T2 | `npm run build:web-static` | ~3 min | Release job / local web-only packaging |
| T3 | `npm run build:desktop` | ~20–60 min | Tag release or manual dispatch |
| T4 | Android build job | ~30–90 min | Manual only |

Do not use T3 as first feedback on small UI changes.

## Platform coverage matrix

| Platform | Kernel CI | Docker CI | Web static CI | Desktop CI | Mobile CI |
| --- | --- | --- | --- | --- | --- |
| Linux x64 | yes | yes | yes | yes (deb) | — |
| Windows x64 | yes | — | yes | yes (NSIS) | — |
| macOS arm64 | yes | — | yes | yes (DMG) | — |
| macOS x64 | yes | — | yes | via cross-target on arm runner | — |
| Android | — | — | — | — | manual dispatch |
| iOS | — | — | — | — | macOS host (not in CI yet) |

## Gaps and next steps

- **Code signing** — Windows/macOS installers are unsigned in CI; operators may need SmartScreen/Gatekeeper overrides until signing secrets are configured.
- **iOS CI** — requires macOS runner + Apple signing; follow [r7-m1-ios-mac-host-handoff-runbook.md](r7-m1-ios-mac-host-handoff-runbook.md).
- **Android CI** — experimental manual dispatch; may need extra web/mobile build steps before reliable.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Tag exists but no Release assets | Workflow failed before `publish-release`, or ran before publish job existed | Check [Actions](https://github.com/Dendro-X0/Vecits/actions) run log; re-tag after fixes |
| Only zip/tar.gz on Tags page | GitHub source archives — not CI artifacts | Open **Releases** or **Actions → Artifacts** |
| `web-shell` / `desktop` job failed | Next.js static export constraints | Run `npm run build:web-static` locally; fix, push, re-tag |
| Kernel artifacts exist, desktop missing | Desktop job is `continue-on-error` | Download kernel/docker/web from Release; desktop optional |

## Related docs

- [operator-quickstart.md](operator-quickstart.md)
- [desktop-release-build.md](desktop-release-build.md)
- [r2-persistent-deployment-runbook.md](r2-persistent-deployment-runbook.md)
- [../specs/deployment-distribution-spec.md](../specs/deployment-distribution-spec.md)

← [Runbooks](README.md)
