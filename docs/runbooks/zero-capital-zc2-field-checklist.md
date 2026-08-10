# Zero-capital ZC-2 field readiness checklist

Purpose: pin a **second device** to a participant-hosted node (LAN or Tailscale) without a project VPS. Complements [zero-capital-operator-runbook.md](zero-capital-operator-runbook.md) § ZC-2 and [r9-halo-operator-runbook.md](r9-halo-operator-runbook.md).

Status: `active` (field proof **people/device gated**)

Last updated: July 2026

Claim when complete with a real second client: **ZC-2 field pin smoke**. Not R6-PD community lane field proof. Not NFC device smoke ([r9-nfc-operator-runbook.md](r9-nfc-operator-runbook.md)).

## Parked / related gates

| Path | Status |
| --- | --- |
| Android NFC write→read on physical tag | **Parked** — needs phone + writable tag; maintainer units already green |
| ZC-2 second device pin (this checklist) | **Ready to run** when you have a second phone/laptop |
| R6-PD human counterparty | **Deferred** — separate runbook |

## Prerequisites

| Need | Notes |
| --- | --- |
| Host machine | ZC-1 data dir (`.data/zc1` or dedicated `.data/halo`) already init’d |
| Reachable URL | Tailscale IP preferred; or LAN `http://<lan-ip>:7878` on trusted Wi-Fi |
| Second client | Phone/tablet/laptop with web or Android shell; not a second VPS |
| Firewall | Allow 7878 from the peer only as needed |

Maintainer shape without travel (not field):

```bash
pnpm r9:halo:join-unit
pnpm r9:halo:smoke
pnpm zc:cold-start:quick   # host still boots clean
```

## Field checklist (solo two-device or with a friend)

### Host

- [ ] Serve on a reachable bind (example LAN):

```bash
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node serve --data-dir ./.data/zc1 --bind 0.0.0.0:7878
# Prefer Tailscale: serve so the Tailscale IP:7878 is reachable
```

- [ ] From the second device: `curl http://<host-ip>:7878/health` → ok
- [ ] Settings → Connection → **Join this node** (absolute URL / QR)

### Second device

- [ ] Import / Pin → **confirm hostname/IP** shown before save
- [ ] Trust / honesty: local or LAN label until upstream sync exists
- [ ] Browse marketplace or overview against the pinned URL (kernel-backed empty states OK)

### Optional deal loop (if both parties can sign)

- [ ] Tiny on-log deal (or fixture drill path) — escrow before work
- [ ] Refuse any off-platform “activation fee” (SOC-01)

### After session

- [ ] Host: `pnpm r2:backup -- --data-dir ./.data/zc1` (or your halo dir)
- [ ] Note pass/fail + host IP type (Tailscale vs LAN) under `target/tmp/zc2-field-<date>/` if desired

## Pass / fail

| Pass | Fail |
| --- | --- |
| Second device health + pin confirm works | Claiming “Vectis cloud” or paid host required |
| Honesty labels for LAN pin | Skipping hostname confirm |
| Deal only on-log (if run) | Off-platform fee treated as protocol payment |

## Related

- [zero-capital-operator-runbook.md](zero-capital-operator-runbook.md)
- [r9-halo-operator-runbook.md](r9-halo-operator-runbook.md)
- [zero-capital-cold-start-checklist.md](zero-capital-cold-start-checklist.md)
- [stability-regression-pack.md](stability-regression-pack.md)
- [../specs/zero-capital-operator-topology-design.md](../specs/zero-capital-operator-topology-design.md)

← [Runbooks](README.md) · [Docs index](../index.md)
