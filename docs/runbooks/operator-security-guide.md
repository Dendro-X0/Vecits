# Operator Security Guide

Purpose: security practices for Vectis node operators (restart era).

Last updated: July 2026

## Key handling (SR-3)

- Ed25519 signing keys stay **client-side** only.
- Never paste secret keys into the node server, Docker env, or shared logs.
- Generate keys per operator device; rotate by creating a new identity if compromised.
- Pin your node `base_url` in client config to prevent phishing endpoints (SOC-07).

## Network exposure

- Default bind: `127.0.0.1:7878` (local only).
- For remote access use TLS-terminating reverse proxy; do not expose SQLite or data dir.
- Optional read token: configure in `peers.json`; health endpoint must not leak secrets (AB-13).
- HTTP ingest rate limit (RES-06): enable on public-facing source nodes to throttle abusive `POST /events` traffic.

## HTTP ingest rate limiting (RES-06)

`POST /events` and `POST /events/batch` support a configurable per-client sliding window limit. **Disabled by default** (`--ingest-rate-limit-max 0`).

```bash
vectis-node node serve \
  --data-dir ./.data/default \
  --bind 0.0.0.0:7878 \
  --ingest-rate-limit-max 120 \
  --ingest-rate-limit-window-seconds 60
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--ingest-rate-limit-max` | `0` | Max HTTP ingest requests per client per window (`0` = disabled) |
| `--ingest-rate-limit-window-seconds` | `60` | Rolling window length in seconds |

Client identity is resolved from `X-Real-IP`, then `X-Forwarded-For` (first hop), then `"local"` for direct tests. Place rate-limited nodes behind a reverse proxy that sets forwarded client IP headers.

Rejected requests return **HTTP 429** with stable code `ERR_INGEST_RATE_LIMIT_EXCEEDED` and `Retry-After` header. CLI `node ingest` is not rate-limited (local operator path).

Verification: `cargo test -p node --test api api_post_events_rate`.

## Event log hash chain (RES-07)

Optional tamper detection for `events.log`. **Disabled by default.** When enabled at init, each ingested event appends a line to `events.chain.jsonl` with rolling SHA-256 chain hashes.

```bash
vectis-node node init --data-dir ./.data/default --events-log-hash-chain
cargo run --bin cli -- log verify-chain --data-dir ./.data/default
```

| Artifact | Purpose |
| --- | --- |
| `events.log` | canonical event JSONL (unchanged) |
| `events.chain.jsonl` | per-event `lineHash` + `chainHash` sidecar |

Tampering `events.log` without updating the chain causes **fail-closed restart** (same posture as AB-14). Does not prevent host compromise — operators should verify backups and chain head after restore.

Verification: `cargo test -p node --test runtime events_log_hash_chain_tamper_fails_closed_on_restart`.

## Backup and integrity

- Authoritative artifact: `events.log` (append-only).
- Daily backup: `npm run r2:backup`
- Weekly evidence: `npm run r2:evidence-pack`
- Treat host compromise as out-of-scope for kernel guarantees (SOC-08); verify replay hash after restore.

## Off-platform payment warning (SOC-01)

**Vectis is not a payment processor.**

Users may treat the platform as communication only and settle via **fiat, crypto, or external URLs** — the secondary market. That human choice is **not enforceable** by the kernel. In-protocol economic contracts (escrow through accept/dispute/settle) **are** enforceable and must be treated as fraud-critical.

| In-protocol (controllable) | Secondary market (not enforced) |
| --- | --- |
| Credits locked via `SpendCredits` → escrow sink | PayPal, Venmo, bank transfer, crypto wallets |
| Delivery + `ServiceAccept` in event log | "Pay me after delivery" chat agreements |
| Dispute/settle events with deterministic outcomes | Redirect to external sites or payment links |
| Full AB-matrix + transaction-spec rigor | Informal refunds or chargebacks |

Operators must:

1. Require escrow funding **in the log** before work starts.
2. Accept delivery only via signed `ServiceAccept` (or dispute flow).
3. Warn counterparties that off-platform payment bypasses reputation and credit close-out.

Credits are **non-transferable** protocol units — not fiat, not crypto, not withdrawable.

## Social threats (summary)

See `docs/specs/security-resilience-spec.md` for SOC-01..SOC-08. The kernel mitigates protocol-level abuse; social pressure and off-log deals remain operator responsibility.

## Related docs

- `docs/runbooks/operator-quickstart.md`
- `docs/runbooks/operator-backup-runbook.md`
- `docs/v0/r4-client-kernel-audit.md`
- `packages/sdk-ts/STABILITY.md`
