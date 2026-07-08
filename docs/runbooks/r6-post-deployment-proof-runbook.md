# R6 — Post-deployment lane proof runbook

Purpose: operator steps to prove a community lane works on a live node with HTTP event submission (post-R6 band).

Status: `active`

Last updated: July 2026

Spec: [../specs/r6-post-deployment-proof-spec.md](../specs/r6-post-deployment-proof-spec.md)

## 1. Preflight (automated)

```bash
pnpm r6:post-deployment:readiness
```

Also run standing kernel checks if changing protocol code:

```bash
pnpm v1:readiness
cargo run --bin cli -- fixtures run
```

## 2. Choose a lane

Pick one community artifact lane from [lane template catalog](../architecture/lane-template-catalog.md):

| Lane | Good first proof? |
| --- | --- |
| `documentation` | ✅ small, clear artifact |
| `software-fixes` | ✅ reference lane |
| `feature-work` | ✅ |
| `compute-job` | use [compute-job-lane-runbook.md](compute-job-lane-runbook.md) instead |
| offline lanes | ❌ experimental — not first proof |

## 3. Solo HTTP drill (self-proof)

Dedicated data dir per lane (do not mix with production):

```bash
pnpm r6:post-deployment:drill -- --lane documentation --data-dir ./vectis-data-r6-docs
```

Other lanes:

```bash
pnpm r6:post-deployment:drill -- --lane feature-work --data-dir ./vectis-data-r6-features
```

Node already running:

```bash
pnpm r6:post-deployment:drill -- --lane translation --base-url http://127.0.0.1:7878
```

Pass: `R2-P2 exchange drill passed` (reuses R2 exchange machinery) + order `closed`.

### All community artifact lanes (maintainer regression)

```bash
pnpm r6:post-deployment:multi-lane-drill -- --no-build
```

One lane only:

```bash
pnpm r6:post-deployment:multi-lane-drill -- --lane translation --no-build
```

## 4. Human counterparty (preferred field proof)

1. Deploy persistent node — [r2-persistent-deployment-runbook.md](r2-persistent-deployment-runbook.md).
2. Provider identity with sponsor vouches posts `ServiceOffer` (lane `serviceType` must match template).
3. Buyer posts `ServiceOrder`, escrows credits, accepts delivery after provider submits `ServiceDelivery`.
4. Verify:

```bash
curl "http://127.0.0.1:7878/state/order/<orderId>?as_of=<RFC3339>"
```

5. Export and archive:

```bash
pnpm r6:post-deployment:phase-c:packet -- \\
  --data-dir ./vectis-data-r6-docs \\
  --lane documentation \\
  --order-id <orderId> \\
  --buyer-pubkey <hex> \\
  --provider-pubkey <hex> \\
  --base-url http://127.0.0.1:7878
```

Maintainer smoke (drill keys — not a field proof):

```bash
pnpm r6:post-deployment:phase-c:smoke
```

Legacy R2 export still works:

```bash
pnpm r2:evidence-export
pnpm r2:evidence-pack
```

Document lane id, pubkeys, and order id in operator notes.

## 5. Mobile client (optional)

If mobile clients connect to this node, pin the public HTTPS URL per [mobile-remote-pinned-node-operator-runbook.md](mobile-remote-pinned-node-operator-runbook.md).

## What does not count

See spec — no fixture ingest, no incomplete milestones, no offline lanes for first proof.

## Related docs

- [community-lane-templates-runbook.md](community-lane-templates-runbook.md)
- [r2-exchange-runbook.md](r2-exchange-runbook.md)
- [operator-backup-runbook.md](operator-backup-runbook.md)
