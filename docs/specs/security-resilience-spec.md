# Security and Resilience Spec (Restart Era)

Purpose: extend v0 technical abuse coverage with restart-era threat model, social attack boundaries, and resilience requirements for widespread deployment.

Status: `locked`

Last updated: July 2026

## Scope

Vectis is not a financial product, but adversaries still benefit from:

- free labor extraction (social)
- escrow gaming and dispute spam (protocol)
- sybil identity farming (trust)
- issuance loop exploitation (economic)
- node tampering and log injection (technical)

Security goal: **make in-protocol abuse expensive, visible, and deterministic** while documenting what cryptography cannot fix.

**Economic contract doctrine:** marketplace events on the controllable platform (escrow, delivery, accept, dispute, settle) are **fraud-critical** — same engineering and test discipline as AB-01..AB-14. Off-platform settlement (fiat, crypto, redirect URLs) is **SOC-01 territory**: documented, warned, never authoritative in kernel or client truth labels.

Canonical model: [../foundation/market-operating-model.md](../foundation/market-operating-model.md) (transaction specs over identity; secondary market boundaries).

## Threat model layers

```text
┌─────────────────────────────────────────┐
│ Social layer (off-protocol promises)    │  ← document limits explicitly
├─────────────────────────────────────────┤
│ Application layer (client UX, phishing) │  ← SDK + operator education
├─────────────────────────────────────────┤
│ Protocol layer (events, settlement)     │  ← AB-01..AB-12 + economics controls
├─────────────────────────────────────────┤
│ Transport layer (sync, read tokens)     │  ← bearer tokens, TLS operator duty
├─────────────────────────────────────────┤
│ Persistence layer (log, snapshots)      │  ← integrity checks, backup verification
└─────────────────────────────────────────┘
```

## Technical threats (baseline: v0 complete)

Existing coverage in `docs/v0/v0-abuse-gaming-test-matrix.md` (`AB-01`..`AB-12`):

| Family | Control status |
| --- | --- |
| Signature forgery | covered |
| Nonce replay | covered |
| Reference chain breaks | covered |
| Unauthorized actors | covered |
| Escrow overfunding | covered |
| Policy takeover | covered |
| Policy version mismatch | covered |
| Issuance rate/diversity farming | covered |
| Economic eligibility bypass | covered |
| Sync duplicate ingest | covered |
| Corrupted snapshot bootstrap | covered |

Restart requirement: **no regression** on AB matrix; any new surface adds AB IDs.

## Social threats (restart-era additions)

These attacks happen partly or wholly off-protocol. The kernel must not pretend to eliminate them.

Canonical operating model: [../foundation/market-operating-model.md](../foundation/market-operating-model.md).

| ID | Pattern | Example | Protocol mitigation | Residual risk |
| --- | --- | --- | --- | --- |
| `SOC-01` | Off-platform payment promise | "PayPal after delivery"; redirect to external payment URL | Escrow required before work; settlement only via in-log events; client warnings | operator/user may still settle off-log |
| `SOC-02` | Scope creep via chat | "Also build feature X" | Milestone-bound acceptance criteria hashes; new scope = new milestone/order | social pressure outside UI |
| `SOC-03` | Charm-and-ghost buyer | Accepts delivery off-log then disappears | In-log accept required for provider reputation/credit close | provider may accept informally |
| `SOC-04` | Colluding vouches | Sybil ring sponsors | Delivery history weight > vouch count in discovery; EC-4 eligibility | slow-to-detect collusion |
| `SOC-05` | Garbage artifact delivery | Valid hash, useless content | Lane templates + operator community norms; not subjective QA in kernel | quality not truth |
| `SOC-06` | Dispute spam / griefing | Repeated frivolous disputes | Reputation decay + lane dispute rate telemetry; deterministic loss profiles | griefing still costly to target |
| `SOC-07` | Fake operator node | Phishing API endpoint | Client pin `base_url`; operator docs on key handling | user error |
| `SOC-08` | Insider log tampering | Host edits `events.log` | Append-only + AB-14 startup validation; optional hash chain (RES-07) | host compromise |

## Restart-era security requirements

### SR-1: Fail closed

Unknown event versions, kinds, policy versions, and evidence formats reject with stable reason codes. Never partial-apply invalid events.

### SR-2: No silent privilege escalation

Relays, sync peers, and read-only replicas cannot settle disputes, mint credits, or activate policy without authorized signed events.

### SR-3: Key material never on server

Signing keys remain client-side. Node stores only public keys from ingested events.

### SR-4: Idempotent sync

Duplicate ingest from malicious or buggy peers cannot corrupt log order or derived state.

### SR-5: Snapshot integrity

Bootstrap from remote snapshot must verify format version, checkpoint hash, and self-consistency before applying deltas.

### SR-6: Operator-visible security telemetry

Economics metrics (`EC-1`..`EC-5`) and dispute rate rollups must remain available for operator monitoring without exposing PII beyond public keys.

### SR-7: Client truth alignment

Web/SDK must label discovery rankings and preflight checks as informational; authoritative state always fetched from kernel API.

## Resilience requirements

| ID | Requirement | R1 target |
| --- | --- | --- |
| `RES-01` | Node restart recovers from JSONL + SQLite without manual repair | yes |
| `RES-02` | SQLite rebuild path from JSONL documented and tested | R1 |
| `RES-03` | Graceful shutdown flushes pending writes | R1 |
| `RES-04` | Peer sync backoff prevents hammering failed peers | exists (Track 4.1) |
| `RES-05` | Corrupted partial write detected on startup | R1 |
| `RES-06` | Rate limit on `POST /events` (configurable) | R5 | `completed` — `--ingest-rate-limit-max`, `ERR_INGEST_RATE_LIMIT_EXCEEDED` |
| `RES-07` | Optional event log hash chain for tamper detection | R5 | `completed` — `--events-log-hash-chain`, `events.chain.jsonl`, `log verify-chain` |

## New abuse test requirements (restart)

Before R2 deployment proof closes:

| ID | Test | Target slice |
| --- | --- | --- |
| `AB-13` | Health endpoint does not leak secrets from `peers.json` | `R1-K4` | `completed` — `api_health_endpoint_does_not_leak_peers_secrets` |
| `AB-14` | Malformed JSONL tail on restart fails closed with explicit error | `R1-D2` | `completed` — `events_log_malformed_tail_fails_closed_on_restart` |
| `AB-15` | Client-side-only "accepted" state never shown without kernel confirm | web SDK audit |
| `SOC-01-doc` | Operator runbook section: off-platform payment warning | `R1-D4` |

## Security documentation deliverables

- `docs/runbooks/operator-security-guide.md` (R1 — key handling, TLS, backup encryption)
- update `docs/v0/v0-abuse-gaming-test-matrix.md` when AB-13+ added
- client onboarding warning for off-protocol settlement (web, R2)

## Verification baseline

```bash
cargo test -p node --test api
cargo test -p node --test sync
cargo test -p state-engine
npm run v1:preflight
```

Restart security sign-off requires AB-01..AB-12 green plus new AB-13/AB-14 before `RDG-5`.

## Explicit non-goals

- End-to-end encrypted social messaging
- AI content moderation
- KYC/identity verification
- Perfect delivery quality assessment
- Legal enforcement integration

These are outside kernel scope by design (design principle 9: explicit limits are healthy).
