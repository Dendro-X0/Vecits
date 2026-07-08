# Phase 2 Compute Job Lane

Purpose: define the first provider-facing tooling slice for the compute-only Phase 2 lane.

This lane is intentionally narrow. It reuses the existing `ServiceOffer` / `ServiceOrder` /
`ServiceDelivery` event model and adds provider tooling on top of the current `job-receipt-v1`
evidence contract instead of introducing a new protocol event kind.

## Current lane contract

`compute-job` template:

- `serviceType`: `compute-job`
- `deliveryMode`: `receipt`
- `allowedEvidenceFormats`: `job-receipt-v1`
- milestone evidence format: `job-receipt-v1`

Current `job-receipt-v1` delivery requirements:

- at least one artifact hash
- unique artifact hashes
- non-empty `notesHash`

## Provider receipt tooling

Primary command:

```bash
npm run v2:compute-receipt -- --job-id <id> --provider <pubkey> --out-dir <path> --output-hash <hash> --notes "<text>"
```

Optional repeatable inputs:

- `--input-hash <hash>`
- `--output-hash <hash>`
- `--url <url>`

Smoke command:

```bash
npm run v2:compute-receipt:smoke
```

## Generated files

The generator writes:

- `job-receipt-v1.json`
- `job-receipt-v1.sha256`
- `job-receipt-v1-notes.sha256`
- `job-receipt-v1-delivery-hints.json`

The receipt JSON is canonicalized before hashing.

## Mapping into `ServiceDelivery`

`job-receipt-v1-delivery-hints.json` is the bridge from provider tooling into the existing event
model.

It contains:

- `evidenceFormat: "job-receipt-v1"`
- `artifactHashes`
  - receipt hash first
  - then declared output hashes
- `notesHash`
  - SHA-256 of the notes text
- `urls`
  - copied through from any `--url` values

These values can be copied directly into the compute-job `ServiceDelivery` flow in the web builder.

The web marketplace builder now includes a compute-specific helper in delivery mode:

- paste the full `job-receipt-v1-delivery-hints.json`
- use `Apply Delivery Hints`
- the builder autofills:
  - `evidenceFormat`
  - `artifactHashes`
  - `urls`
  - `notesHash`

## Related docs

- [../runbooks/compute-job-lane-runbook.md](../runbooks/compute-job-lane-runbook.md) — operator drill (`npm run r6:compute-job:drill`)

## Out of scope in this slice

- new protocol event kinds
- new node HTTP endpoints
- a dedicated provider web panel
- shared compute+AI abstractions
- execution receipts with stronger attestation or reproducibility proofs
