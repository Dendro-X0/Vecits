# Restart Decisions (Locked)

Purpose: resolve exploration questions that block restart-era implementation. These decisions apply from July 2026 forward unless explicitly superseded.

Status: `locked`

Last updated: July 2026

## D1. Product identity

**Decision:** **Vectis** is the name for the full stack — kernel, settlement engine, and official client — not a single centralized marketplace product.

- The durable artifact is deterministic replay + settlement + sync (the coordination layer operators integrate like Stripe)
- Web and SDK clients are **replaceable shells**; operators may run **custom-branded stores and marketplaces**
- The reference app (`apps/web`) demonstrates flows; it is not the only storefront
- "Production-ready" means **operator-deployable kernel** plus easy integration; consumer polish is per-operator

See `docs/foundation/product-identity.md` for naming and ease targets (Shopify deploy, Stripe integrate).

**Rationale:** Aligns with solo stewardship, anti-platform lock-in, white-label operator stores, and cross-community deployment.

## D2. Language and stack

**Decision:** No stack change at restart.

- Rust: protocol core, state engine, node runtime, CLI binary
- TypeScript: SDK, web client, operator scripts
- Storage: append-only JSONL event log + SQLite materialized views + snapshot files

**Rationale:** Existing v0 evidence (`G1`, `G4`) is Rust-native; TS must not become a second source of truth.

## D3. Refactoring posture

**Decision:** Radical refactoring is allowed **outside** sacred invariants.

Sacred invariants (non-negotiable):

1. Same valid event log + same `as_of` → same derived state on every honest node
2. Stable reject reason codes for invalid events (no silent drops)
3. `genesis_replay` ≡ `snapshot_plus_delta` for valid logs
4. Economic invariants in `docs/foundation/economic-protocol-v1.md` (non-transferability, decay, no admin arbitration)
5. Event envelope `v0` compatibility until an explicit version cutover per `docs/architecture/event-versioning-strategy.md`

Fair game for refactor:

- crate public API surfaces and module boundaries
- deployment packaging and directory layout
- client UI architecture (may rebuild web app)
- sync transport details beyond idempotent convergence contract
- operator scripts and evidence tooling

## D4. First deployment target

**Decision:** Optimize restart for **single-operator, local-first deployment** before multi-community federation.

Minimum viable deployment:

- one machine
- one persistent data directory
- one HTTP API bind address
- verifiable backup/restore via snapshot + JSONL

Federation (multi-node, peer sync) remains required regression coverage but is not the first UX priority.

## D5. First proof-of-value scenario

**Decision:** First real deployment proof uses **`project-maintenance`** or **`software-fixes`** lane, not compute-job.

- Artifact-hash evidence is already fixture-proven across lanes
- Aligns with maintainer profile (many repos, OSS stewardship)
- Compute-job lane (`Phase 2`) continues in parallel but does not gate first deployment proof

## D6. Credits semantics (restart era default)

**Decision:** Credits remain **coordination fuel**, not purchasing power or wealth.

- Issuance: contribution mint flow + marketplace close events only
- Spending: sink-bound (`ServiceEscrowSink`, allowed sink types)
- Refunds: synthetic lot creation via deterministic settlement events, not peer transfer
- Durable value: reputation and verified delivery history

Unresolved for later (does not block restart):

- exact demurrage parameters per community policy pack
- provider-mint expiry tuning per lane

## D7. Trust and sybil resistance (restart era default)

**Decision:** Invite-only web-of-trust bootstrapping with delivery-history weighting.

- Minimum viable sybil resistance: sponsor vouch requirement + replay-visible history
- Delivery history outweighs vouch count for marketplace eligibility in discovery ranking
- No global identity registry; each operator ingests the same public event log
- **Early public phase:** transparent founding voucher cohort + policy-limited blast radius until graph densifies; see `docs/foundation/market-operating-model.md` (Trust bootstrap)

**Fraud posture:** transaction specifications (escrow, evidence, timeouts) are primary; identity/vouches are secondary admission signals. Off-platform settlement is uncontrollable; in-log economic contracts receive full anti-fraud treatment.

## D8. Marketplace scope (restart era default)

**Decision:** Standardized lane templates first; negotiated open-ended contracts excluded.

- Offers use lane templates with enforced `serviceType`, `deliveryMode`, `allowedEvidenceFormats`
- Milestones must include explicit acceptance criteria hashes where lane requires them
- Subjective creative work remains out of scope

## D9. Dispute philosophy

**Decision:** Deterministic loss profiles; no human arbitration in kernel.

- Timeout → auto-refund or settle per policy
- Deadlock → both-side penalties where policy defines them
- Third-party attestation limited to contribution mint paths, not marketplace truth arbitration

See `docs/foundation/market-operating-model.md` for multi-store P2P operation and social-threat boundaries.

## D10. Discovery integration priority

**Decision:** Aperio feeds **structured offer drafts**, not settlement or credit minting.

- Discovery reduces search cost; protocol enforces exchange
- Bridge is CLI/worker-first (no Next.js dependency)
- Signed signal envelopes are optional in R-track; required before federation-scale deployment

## D11. Naming and packaging (restart era)

**Decision:** Protocol name **Vectis**; workspace/package rename is deferred until R1 packaging slice.

- Current crate names (`protocol-core`, `node`, etc.) remain during R0/R1
- Binary distribution artifact target name: `vectis-node` (alias acceptable for `cli` during transition)
- npm scope rename (`@new-start/*` → `@vectis/*`) is optional and non-blocking

## D12. Evidence discipline

**Decision:** No restart slice marked complete without linked verification commands.

Proof layers (in order):

- L1: unit/replay tests (`cargo test`)
- L2: fixture bundle (`cargo run --bin cli -- fixtures run`)
- L3: node API/sync integration tests
- L4: operator runbook or script executed from clean environment

## Open questions intentionally deferred

These remain in `docs/foundation/open-questions.md` and do not block restart R1:

- public-chain checkpoint anchoring
- mobile/native client shells
- offline lane production deployment (`local-resource-exchange`, `physical-handoff`)
- community governance for policy updates beyond embedded default policy
