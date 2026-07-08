# Mobile Remote Pinned Node — Operator Runbook

Purpose: guide operators who host a `vectis-node` instance for official mobile clients (Android/iOS) using **remote pinned node mode** (R7-M2).

Status: `active`

Last updated: July 2026

## When to use this runbook

Use this when mobile users connect to **your** node over HTTPS — not when they run a local sidecar (desktop pattern) or experiment with on-device nodes (R7-M3+, deferred).

Policy reference: [../specs/mobile-sidecar-policy-spec.md](../specs/mobile-sidecar-policy-spec.md)

Client wiring spec: [../specs/r7-m2-remote-pinned-node-wiring-spec.md](../specs/r7-m2-remote-pinned-node-wiring-spec.md)

## Operator checklist

1. Deploy a persistent `vectis-node` (see [r2-persistent-deployment-runbook.md](r2-persistent-deployment-runbook.md)).
2. Expose the node API over **HTTPS** at a stable public base URL (e.g. `https://node.example.com`).
3. Confirm `GET /health` returns `"status":"ok"` through the public URL.
4. Pin that base URL in mobile release builds.
5. Have mobile users verify **Settings → Kernel connection** shows the pinned URL and source.

## HTTPS requirement

| Build mode | Pinned node URL |
| --- | --- |
| Dev / debug | HTTP allowed (e.g. `http://10.0.2.2:7878` on Android emulator) |
| Release | **HTTPS required** — mobile app rejects non-HTTPS pinned URLs |

Release builds set `VECTIS_MOBILE_RELEASE=1` / `NEXT_PUBLIC_VECTIS_MOBILE_RELEASE=1` via the mobile command wrappers.

## CORS and API access

`vectis-node` enables permissive CORS (`allow_origin: Any`) so mobile WebViews can call the node API directly. Operators still must:

- Terminate TLS at nginx/Caddy/Cloudflare (or equivalent).
- Restrict admin surfaces; expose only the node HTTP API port needed for client traffic.
- Keep rate limits enabled (see [operator-security-guide.md](operator-security-guide.md)).

## Example: reverse proxy (Caddy)

```text
node.example.com {
  reverse_proxy 127.0.0.1:7878
}
```

Verify:

```bash
curl https://node.example.com/health
```

## Pin URL in mobile builds

### Android release

```bash
npm run r7:mobile:android:build -- --release --pinned-node-url https://node.example.com
```

### iOS release (macOS host)

```bash
npm run r7:mobile:ios:build -- --release --pinned-node-url https://node.example.com
```

### Dev override (non-release only)

Mobile users may set **Settings → Mobile pinned node URL override** when release policy is not enabled.

## End-user verification

1. Open app → **Settings → Kernel connection**
2. Confirm connected node URL matches your operator host
3. Register identity or start an exchange
4. If misconfigured, UI shows **Kernel unreachable** with link to Settings

Smoke runbook for developers: [r7-m2-remote-node-smoke-runbook.md](r7-m2-remote-node-smoke-runbook.md)

## Workspace verification (maintainer)

```bash
pnpm r7:mobile:readiness
pnpm v1:readiness
```

## Security notes

- Mobile clients sign events locally; the node validates and replays — settlement authority stays server-side.
- Do not ask users to send secret keys to the operator.
- Off-protocol payment remains outside kernel enforcement (SOC-01).
- Back up the node data dir on schedule: [operator-backup-runbook.md](operator-backup-runbook.md).

## Related docs

- [operator-quickstart.md](operator-quickstart.md)
- [mobile-scaffold-runbook.md](mobile-scaffold-runbook.md)
- [r7-m2-remote-node-smoke-runbook.md](r7-m2-remote-node-smoke-runbook.md)
