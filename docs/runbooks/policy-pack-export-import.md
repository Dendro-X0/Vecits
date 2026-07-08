# Policy Pack Export / Import

Purpose: operator guide for community policy packs — export effective policy, review offline, sign `PolicyUpdate`, ingest to node.

Status: `active`

Last updated: July 2026

## What is a policy pack?

A **policy pack** is a versioned JSON document (`policy-pack-v1`) that captures the full `PolicySnapshotPayload` a community intends to activate via a signed `PolicyUpdate` event. Communities customize lanes, credit limits, issuance controls, and eligibility thresholds without forking the kernel.

Checked-in reference packs:

| Pack | Path | Effect |
| --- | --- | --- |
| Restricted lanes | `fixtures/policy-packs/community-lanes-restricted.json` | `v0-policy-1` — software-fixes + documentation only |
| P2H issuance tight | `fixtures/policy-packs/p2h-issuance-tight.json` | `v0-policy-p2h` — issuance window + P2H band cap (SCN-19) |

## Export

From a running node (effective policy at current replay head):

```bash
node scripts/r5-policy-pack-export.mjs \
  --from-node http://127.0.0.1:7878 \
  --pack-id my-community-baseline \
  --description "Exported from production node" \
  --out ./target/tmp/my-community-baseline.json
```

From an existing fixture `PolicyUpdate` event:

```bash
node scripts/r5-policy-pack-export.mjs \
  --from-event fixtures/valid/policy-update-forward.jsonl \
  --pack-id imported-forward \
  --out ./target/tmp/imported-forward.json
```

## Import (operator flow)

1. Review the pack JSON offline — confirm `allowedServiceTypes`, issuance limits, and `policyAuthorityPubKey`.
2. Set `effectiveAt` to a future UTC timestamp (monotonic vs prior updates).
3. Sign with the **policy authority** secret key (must match `policy.policyAuthorityPubKey`).
4. Ingest via `POST /events` or append to operator event log.

Automated replay drill (L3):

```bash
pnpm --filter @new-start/sdk-ts build
npm run r5:policy-pack:import-drill
npm run r5:policy-pack:import-drill -- --pack fixtures/policy-packs/p2h-issuance-tight.json
```

## Federation discovery merge

Multi-operator discovery feeds merge by `dedupeKey` (fallback: canonical `signalId`). Optional signed envelopes (`discovery-signal-envelope-v1`) verify operator provenance before merge.

```bash
# Merge two operator JSONL feeds
node scripts/v3-discovery-federation-merge.mjs \
  --in ./operator-a/signals.jsonl \
  --in ./operator-b/signals.jsonl \
  --out ./target/tmp/merged-signals.jsonl

# Require signed envelopes (federation hardening)
node scripts/v3-discovery-federation-merge.mjs \
  --require-signed \
  --in ./operator-a/signed-signals.jsonl \
  --out ./target/tmp/merged-signed.jsonl

# Smoke (dedupe + envelope verification)
npm run v3:discovery-federation:smoke
```

Pipeline after merge: `v3-discovery-bridge.mjs` → offer drafts → operator review → sign → ingest.

## Verification

| Layer | Command |
| --- | --- |
| L1 | `npm run r5:policy-pack:import-drill` |
| L2 | `npm run v3:discovery-federation:smoke` |
| L3 | `cargo run --bin cli -- fixtures run` (unchanged fixture bundle) |
| L4 | `npm run r5:two-node:drill -- --with-policy-pack fixtures/policy-packs/community-lanes-restricted.json` |

## Related

- [../specs/deployment-distribution-spec.md](../specs/deployment-distribution-spec.md) — customization model
- [../specs/discovery-bridge-spec.md](../specs/discovery-bridge-spec.md) — signal schema + federation merge
- [operator-genesis-runbook.md](operator-genesis-runbook.md) — founding trust bootstrap before policy tighten
