# Compute Job Lane Runbook (R6-L1)

Purpose: operator path for the Phase 2 `compute-job` lane — post offer, run work, generate `job-receipt-v1` evidence, deliver, and accept.

Last updated: July 2026

## Lane contract

| Field | Value |
| --- | --- |
| `serviceType` | `compute-job` |
| `deliveryMode` | `receipt` |
| `allowedEvidenceFormats` | `job-receipt-v1` |
| Milestone `evidenceFormat` | `job-receipt-v1` |

Lane architecture: [../architecture/phase2-compute-job-lane.md](../architecture/phase2-compute-job-lane.md)

Fixture reference: `fixtures/valid/marketplace-compute-job-accept.jsonl`

## Prerequisites

- Running Vectis node ([operator-quickstart.md](operator-quickstart.md))
- Node.js 20+ for receipt tooling
- Buyer has credits; provider has sponsor vouches (policy threshold = 2)

## Option A — Automated drill (solo operator)

Proves the full compute-job exchange on a dedicated data dir via HTTP ingest (not fixture replay):

```bash
npm run v1:build-release
npm run r6:compute-job:drill

# Node already running
npm run r6:compute-job:drill -- --base-url http://127.0.0.1:7878

# Custom data dir
npm run r6:compute-job:drill -- --data-dir ./.data/r6
```

Pass criteria: script prints `R6-L1 compute-job drill passed` and order status is `closed`.

Artifacts under `target/tmp/r6-compute-job-<runId>/`:

- `r6-compute-job-events.jsonl` — signed events submitted via HTTP
- `receipt/job-receipt-v1.json` — canonical receipt
- `receipt/job-receipt-v1-delivery-hints.json` — copy into builder delivery step
- `exchange-summary.json`
- `operator-notes.md`

Receipt smoke (tooling only, no node):

```bash
npm run v2:compute-receipt:smoke
```

## Option B — Human provider workflow

### 1. Provider posts offer

`ServiceOffer` with:

- `serviceType`: `compute-job`
- `deliveryMode`: `receipt`
- `allowedEvidenceFormats`: `["job-receipt-v1"]`

### 2. Buyer opens order and escrows credits

`ServiceOrder` → `SpendCredits` (escrow sink) for the milestone.

### 3. Provider runs job and generates receipt

```bash
npm run v2:compute-receipt -- \
  --job-id <order-or-job-id> \
  --provider <provider-pubkey-hex> \
  --out-dir ./receipt-out \
  --output-hash <sha256-of-output-artifact> \
  --notes "what was computed and how to verify" \
  --url "https://example.com/artifact-location"
```

Optional repeatable flags: `--input-hash`, `--output-hash`, `--url`.

### 4. Provider posts delivery

Copy fields from `job-receipt-v1-delivery-hints.json` into `ServiceDelivery`:

- `evidenceFormat`: `job-receipt-v1`
- `artifactHashes` (receipt hash first, then output hashes)
- `notesHash`
- `urls`

Web builder: paste the delivery-hints JSON and use **Apply Delivery Hints** on the compute-job delivery step.

### 5. Buyer accepts

Post `ServiceAccept` referencing the delivery event.

Verify:

```bash
curl "http://127.0.0.1:7878/state/order/<orderId>?as_of=<RFC3339>"
# expect "status": "closed"
```

## Receipt requirements (`job-receipt-v1`)

- At least one artifact hash in delivery (receipt hash + output hashes)
- Unique artifact hashes
- Non-empty `notesHash` (SHA-256 of provider notes text)

## What does not count as lane proof

- Ingesting `fixtures/valid/marketplace-compute-job-*.jsonl` without HTTP submission
- Delivery with `evidenceFormat: artifactHash` (wrong lane)
- Missing or duplicate artifact hashes in `ServiceDelivery`

## Related docs

- [phase2-compute-job-lane.md](../architecture/phase2-compute-job-lane.md)
- [r2-exchange-runbook.md](r2-exchange-runbook.md)
- [operator-quickstart.md](operator-quickstart.md)
