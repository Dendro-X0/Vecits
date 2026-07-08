# Vectis vs Traditional Blockchain (Exploration)

Purpose: research note comparing conventional blockchain/Web3 systems with Vectis — what overlaps, what diverges, and what that implies for **client and product** work.

Status: `exploration` (not a protocol spec)

Last updated: July 2026

**Paused threads:** secondary-market attestation and off-protocol payment proof are out of scope here. See [market-operating-model.md](market-operating-model.md) for boundaries only.

## Executive summary

Vectis is **not** “a freelance platform with blockchain added on top” and **not** a speculative cryptocurrency. It is an **anti-financial coordination kernel**: signed events, deterministic replay, operator-run nodes, and replaceable clients.

It shares some **ledger-like** properties with blockchains (append-only history, cryptographic authorship, multi-party convergence) but rejects the **financial and execution model** that defines most chains (transferable tokens, on-chain settlement rails, smart-contract-as-law without off-chain semantics).

Think: **decentralized ledger semantics without chain-first product design.**

## Comparison at a glance

| Dimension | Typical public blockchain | Vectis |
| --- | --- | --- |
| **Primary asset** | Native token / coin (transferable, priced) | Non-transferable, expiring **credits** (coordination fuel) |
| **Value thesis** | Trust-minimized value transfer & programmability | Trust-minimized **work coordination** & reputation |
| **Execution** | On-chain VM (EVM, etc.); gas-metered | Off-chain **Rust replay**; HTTP ingest + local SQLite |
| **State truth** | Chain state at block N | Derived state at `as_of` from event log replay |
| **“Smart contract”** | Deployed bytecode on chain | **Policy + reducers** in `state-engine`; versioned in replay |
| **Consensus** | Global miners/validators; fork choice | Operator sync + **deterministic replay** (honest nodes converge) |
| **Identity** | Wallet address | Ed25519 pubkey + `IdentityCreate` + vouch graph |
| **Disputes** | Often oracle + governance vote | **State machine + timeouts**; no human arbitration in kernel |
| **Fees** | Gas, MEV, bridge fees | Operator hosting cost; no protocol gas |
| **UX default** | Wallet connect, chain switch, tx confirm | Key unlock + sign event + node API (Shopify/Stripe ease target) |
| **Financial rails** | Often explicit (ETH, stablecoins) | **Explicitly excluded** in-protocol ([economic-protocol-v1.md](economic-protocol-v1.md)) |
| **Speculation** | Feature (DEX, NFT floors) | **Anti-goal** (design principles 2–4) |
| **Public chain** | Required for “real” deployment | **Optional future** checkpoint anchoring only ([v0-architecture.md](../architecture/v0-architecture.md)) |

## What Vectis borrows from ledger design

These are deliberate engineering choices, not marketing:

1. **Append-only event log** — `events.log` is the durable history; tamper detection (AB-14, future hash chain RES-07).
2. **Cryptographic authorship** — Ed25519 signatures on canonical JSON; bad signatures fail closed (AB-01).
3. **Deterministic derivation** — same valid log + same `as_of` → same state (`K-04`: genesis ≡ snapshot+delta).
4. **Multi-operator convergence** — pull sync; duplicate ingest idempotent (AB-11); bootstrap integrity (AB-12).
5. **Auditability** — replay, snapshots, evidence export; no “trust our database.”

Users get **ledger-grade inspectability** without requiring a public chain for every action.

## What Vectis rejects (and why)

### 1. Token-first economics

Blockchains often center a **transferable, hoardable, speculatable** unit. Vectis economic invariants forbid that path:

- no in-protocol fiat/crypto settlement
- no transferability or inheritance of credits
- demurrage/expiry by default
- durable value in **reputation**, not balance

**Anti-financial** here means: reduce money-shaped incentives that reproduce freelance-platform extraction and scam dynamics — not “no accounting.”

### 2. On-chain execution as the product

Smart contracts excel at **simple, fully on-chain state** (token balances, AMM swaps). Marketplace coordination needs:

- artifact delivery evidence
- milestone semantics
- dispute clocks
- lane templates
- reputation history

Vectis implements these as **replay reducers** with stable reason codes — faster to evolve, cheaper to run, and testable with fixtures (`cargo test`, AB matrix).

### 3. Global consensus as gatekeeper

Public chains optimize for **one world state** at high cost. Vectis optimizes for **local-first nodes** that converge when they share events — closer to federated/email than to L1 maximalism.

### 4. Governance-by-vote as default dispute layer

DAO votes and multisig councils are human arbitration with extra steps. Vectis uses **policy parameters + deterministic loss profiles** (D9). Imperfect but adminless.

### 5. Wallet-as-identity UX without semantics

A blockchain address proves key possession, not **delivery history** or **lane eligibility**. Vectis separates:

- **key** = who can sign
- **transaction spec** = what economic contracts mean
- **reputation** = what history suggests (secondary to settlement rules)

## “Smart contract” vs Vectis replay

| Concept | Blockchain habit | Vectis equivalent |
| --- | --- | --- |
| Contract deploy | Bytecode on chain | Embedded policy snapshot + reducer version |
| Call / tx | Signed tx invokes method | Signed **event** ingested to log |
| Revert | EVM revert | `InvalidReasonCode`; event rejected; no partial apply |
| Upgrade | Proxy / new deploy | Forward-only `PolicyUpdate` events |
| View call | `eth_call` | `GET /state/*?as_of=` |
| Audit | Explorer + contract source | Fixture replay + `npm run r2:evidence-pack` |

Client implication: the **official Vectis client** signs and submits events; it does **not** deploy or call chain contracts.

## Anti-freelance-platform vs anti-blockchain?

Vectis opposes both **patterns** when they harm coordination:

| Toxic pattern | Freelance platform version | Crypto/blockchain version |
| --- | --- | --- |
| Extraction | Platform fees, lock-in, opaque ranking | Gas, MEV, rent on liquidity |
| Scam surface | Off-platform payment redirect | Rug pulls, unaudited contracts, bridge hacks |
| Trust theater | “Verified” badges | “On-chain” without meaningful semantics |
| Hoarding | Account balances / credits cash-out | Token speculation |

Vectis alternative: **small milestones**, **in-protocol escrow**, **reputation over balance**, **inspectable rules** — community productive vitality without reproducing money-first freelance markets.

## Optional future: chain as anchor, not engine

[v0-architecture.md](../architecture/v0-architecture.md) recommends:

- protocol **chain-light** in v0
- no smart contracts required for core marketplace flow
- **optional** public-chain anchoring for checkpoint / audit roots (deferred)

If added, anchoring should be **notarization** (hash of snapshot at time T), not settlement execution. Settlement stays in replay.

## Implications for client and features (refocus)

Exploration pauses secondary-market protocol design. **Active product surface** is the replaceable **Vectis client** + SDK on top of the kernel.

### Current client inventory (`apps/web` + `packages/sdk-ts`)

| Area | What exists | Kernel truth? |
| --- | --- | --- |
| **Onboarding** | Keygen, `IdentityCreate`, sponsor vouch drafts | Ingest-gated |
| **Marketplace builder** | Lane templates, offer/order/milestone event chains | Session checklist non-authoritative until ingest |
| **Contribution builder** | Claim / attest / mint drafts | Sign + submit only |
| **Explorer** | Identity, balance, offers, orders, milestones, reputation, policy, discovery | Read-only from node API |
| **Operator panels** | Preflight, GA6, evidence export hooks | Command tooling; labels kernel vs session |
| **SDK** | Sign, verify, `NodeClient` HTTP wrappers | No settlement math ([STABILITY.md](../../packages/sdk-ts/STABILITY.md)) |
| **Truth UX** | `KernelTruthNotice`, SOC-01 onboarding warning | R4-C3/C4 |

### Client principles (R4 audit)

1. **Thin shell** — no local escrow/balance settlement logic.
2. **Sign locally, confirm from kernel** — AB-15.
3. **Customizable storefronts** — white-label apps; same API contract.
4. **Ease target** — Shopify deploy, Stripe integrate ([product-identity.md](product-identity.md)); not “connect wallet, pick chain.”

### Near-term client backlog (from roadmap)

| ID | Feature | Notes |
| --- | --- | --- |
| `R3-B5` | Discovery bridge → web draft import | deferred; CLI bridge done |
| `R4-C5` | Marketplace UI simplification | deferred post-R2/R3 |
| `R5+` | Policy pack UX, federation operator views | planned |

### What “blockchain-like UX” should **not** mean for Vectis

- Chain picker, gas estimation, block explorer as primary metaphor
- Token balance as hero metric
- “Tx pending” without milestone semantics

### What it **should** mean

- Clear **event log** and **replay source** in explorer
- **Milestone state** from kernel API
- **Signed action** confirmations with event IDs
- Portable history across operator nodes (sync story)

## When someone asks “why not just use a blockchain?”

Short answers:

1. **Economics** — we are anti-financial coordination, not token issuance.
2. **Semantics** — marketplace disputes need rich off-chain evidence, not just transfers.
3. **Evolution** — replay + policy updates beat immutable contract redeploys for v0 iteration.
4. **Operations** — solo/small-community operators need `vectis-node` on one machine, not chain ops.
5. **Honesty** — we still get auditability without pretending USDC/PayPal scams are solved on-chain.

## Open exploration questions

- Minimal checkpoint anchoring design (which chain, what hash, who pays) — deferred in [open-questions.md](open-questions.md).
- Client passkey key vault — UX research, not protocol change.
- How much “ledger” metaphor helps vs confuses non-crypto operators in UI copy.

## Related docs

- [project-thesis.md](project-thesis.md) — not marketplace + blockchain; not normal cryptocurrency
- [economic-protocol-v1.md](economic-protocol-v1.md) — anti-financial invariants
- [product-identity.md](product-identity.md) — Vectis client vs kernel
- [market-operating-model.md](market-operating-model.md) — transaction specs over identity
- [../architecture/v0-architecture.md](../architecture/v0-architecture.md) — blockchain position
- [../v0/r4-client-kernel-audit.md](../v0/r4-client-kernel-audit.md) — client boundaries
- [../roadmap/restart-roadmap.md](../roadmap/restart-roadmap.md) — R3/R4 active tracks
