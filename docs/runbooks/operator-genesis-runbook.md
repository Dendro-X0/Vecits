# Operator Genesis Runbook (L4)

Purpose: prove **cold-start provider admission** on a live operator node — founding sponsors publish pubkeys, ingest founding `Vouch` events on-log, and a new provider crosses `provider_eligibility_threshold` before posting `ServiceOffer`.

Last updated: July 2026

Related: [../specs/trust-bootstrap-and-credits-path-spec.md](../specs/trust-bootstrap-and-credits-path-spec.md) (SCN-17), [r2-exchange-runbook.md](r2-exchange-runbook.md).

## Proof bar

- Two documented founding sponsor pubkeys (visible cohort)
- Provider with **zero** vouches cannot post a live `ServiceOffer` (event may ingest but replay marks it invalid and offer is absent from state)
- After two founding vouches, provider posts `ServiceOffer` via `POST /events`
- Offer is replay-visible: `GET /state/offer/{id}` status `active` and listed in `GET /state/discovery`
- Events submitted through the running node API, **not** via `node ingest --in fixtures/...`

## Option A — Automated drill (solo operator)

```bash
pnpm --filter @new-start/sdk-ts build
npm run v1:build-release

# Dedicated genesis proof dir (default ./vectis-data-r2-genesis)
npm run r2:genesis-drill

# Node already running
npm run r2:genesis-drill -- --base-url http://127.0.0.1:7878

# Genesis + evidence export
npm run r2:genesis-drill -- --export-evidence
```

Pass criteria: script prints `R2 genesis drill passed` and pre-vouch offer is rejected.

Artifacts under `target/tmp/r2-genesis-<runId>/`:

| File | Contents |
| --- | --- |
| `founding-sponsors.json` | Published sponsor pubkey list for operators |
| `r2-genesis-events.jsonl` | Full signed event bundle |
| `genesis-summary.json` | Machine-readable proof summary |
| `operator-notes.md` | Human-readable operator record |

## Option B — Human founding cohort

1. Start persistent node ([operator-quickstart.md](operator-quickstart.md)).
2. **Publish** founding sponsor pubkeys (website, README, or `founding-sponsors.json` in your deployment repo).
3. Each sponsor creates identity (`IdentityCreate`) and signs `Vouch` → `subjectPubKey` = new provider, `weight: 1`.
4. Provider creates identity, collects vouches until `incoming_vouch_score >= 2` (default policy).
5. Provider posts first `ServiceOffer` on an allowed lane (e.g. `software-fixes`).
6. Verify:

```bash
curl "http://127.0.0.1:7878/state/offer/<offerId>?as_of=<RFC3339>"
curl "http://127.0.0.1:7878/state/discovery?service_type=software-fixes&alpha_defaults=0"
```

7. Archive `founding-sponsors.json` + operator notes with your evidence pack.

## Drill key material (Option A only)

| Role | Secret key (hex) |
| --- | --- |
| Founding sponsor A | `6666…6666` (64× `6`) |
| Founding sponsor B | `7777…7777` (64× `7`) |
| Genesis provider | `8888…8888` (64× `8`) |

Defined in `scripts/lib/r2-genesis-core.mjs`. Do **not** reuse in production.

## What does not count as L4 genesis proof

- Ingesting `fixtures/valid/bootstrap-provider-vouch-eligibility.jsonl` into production data dir
- Manually editing SQLite state
- Posting offers before vouches without recording the expected rejection

## Next step after genesis

Run [r2-exchange-runbook.md](r2-exchange-runbook.md) for a full buyer mint → escrow → accept exchange (R2-P2).
