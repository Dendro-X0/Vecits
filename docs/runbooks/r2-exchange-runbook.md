# R2 Exchange Runbook (R2-P2)

Purpose: complete one real structured exchange on a persistent operator node — full offer→accept path in the production event log.

Last updated: July 2026

## Proof bar

- Lane: `project-maintenance` or `software-fixes`
- Two distinct identities: operator (buyer) + counterparty (provider)
- Events submitted through the running node API (`POST /events`), **not** via `node ingest --in fixtures/...`
- Milestone reaches **accepted** (order status `closed`)
- Evidence exported with operator notes

## Option A — Automated drill (solo operator)

Use when you need to close R2-P2 locally before a human counterparty is available. Uses dedicated R2 keypairs (distinct from alpha fixture alice/bob/carol).

```bash
npm run v1:build-release

# Default lane: project-maintenance on `./.data/r2` (dedicated R2 proof dir)
npm run r2:exchange-drill

# Other lane
npm run r2:exchange-drill -- --lane software-fixes

# Node already running on 7878
npm run r2:exchange-drill -- --base-url http://127.0.0.1:7878

# Exchange + evidence export in one step
npm run r2:exchange-drill -- --export-evidence
```

Pass criteria: script prints `R2-P2 exchange drill passed` and order status is `closed`.

Artifacts land under `target/tmp/r2-exchange-<runId>/`:

- `r2-exchange-events.jsonl` — signed events submitted via HTTP
- `exchange-summary.json`
- `operator-notes.md`

Then archive proof:

```bash
npm run r2:evidence-export
npm run r2:restore-drill
```

## Option B — Human counterparty (preferred for RG-3 narrative)

1. Start your persistent node:

```bash
BIN="$(npm run -s v1:resolve-release)"
"$BIN" node serve --data-dir ./.data/default --bind 127.0.0.1:7878
```

2. **Operator (buyer)** — create identity via onboarding wizard or SDK; obtain credits through contribution flow.
3. **Counterparty (provider)** — create identity on their machine; collect two sponsor vouches (policy threshold = 2).
4. **Provider** posts `ServiceOffer` for the chosen lane.
5. **Operator** posts `ServiceOrder`, `SpendCredits` (escrow), then after delivery **operator** posts `ServiceAccept`.
6. Verify:

```bash
curl "http://127.0.0.1:7878/state/order/<orderId>?as_of=<RFC3339>"
# expect "status": "closed"
```

7. Export evidence and fill in `operator-notes.md` with real names/pubkeys.

Web shell: use the marketplace event builder at `/builder` (reference UI — not required for R2 proof).

## Key material (Option A drill only)

| Role | Secret key (hex) |
| --- | --- |
| Operator / buyer | `4444…4444` (64× `4`) |
| Counterparty / provider | `5555…5555` (64× `5`) |
| Sponsor A | `6666…6666` |
| Sponsor B | `7777…7777` |

Defined in `scripts/lib/r2-exchange-core.mjs`. Do **not** reuse these keys in production deployments.

## What does not count as R2-P2

- Ingesting `fixtures/valid/marketplace-*.jsonl` into `./.data/default`
- Replay-only tests without appending to the operator production log
- Exchange that stops before `ServiceAccept` (milestone not closed)

## Related docs

- `docs/roadmap/r2-deployment-proof-execution-plan.md`
- `docs/runbooks/operator-backup-runbook.md`
- `docs/runbooks/alpha-operations-runbook.md`
