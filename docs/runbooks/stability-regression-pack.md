# Stability regression pack

Purpose: one maintainer command that means **day-to-day operable**, not just protocol-correct.

Status: `active`

Last updated: July 2026

Claim: maintainer regression green. Not a human counterparty field proof.

## What it runs

| Step | Proof | Skip flag |
| --- | --- | --- |
| Protocol fixtures | `cargo run --bin cli -- fixtures run` | `--skip-fixtures` |
| ZC cold-start | `pnpm zc:cold-start` (requires existing `.data/zc1`) | `--skip-cold-start` |
| SX-S5 staged exchange | `pnpm sx:s5` multi-milestone software-fixes | `--skip-sx` |
| R4 client audit + SX guidance | `pnpm r4:client-audit` · `pnpm sx:guidance:unit` | `--skip-audit` |

## Commands

```bash
pnpm stability:pack          # full pack (may build release binaries)
pnpm stability:pack:quick    # --no-build for node drills
```

Flags (after `--`):

```bash
pnpm stability:pack:quick -- --skip-fixtures
pnpm stability:pack:quick -- --skip-cold-start
```

## Prerequisites

- Rust toolchain for fixtures step
- Release binary available (or omit `--no-build` so drills can build)
- **`.data/zc1/manifest.json` exists** for cold-start — seed once:

```bash
pnpm zc:s4
# or
pnpm zc:cold-start -- --allow-init
```

## Pass / fail

| Pass | Fail |
| --- | --- |
| All selected steps exit 0 | Any step fails |
| Cold-start finds existing data dir | Silent init of “production” path |
| SX-S5 both milestones Accepted + order closed | Single-milestone-only smoke treated as staged proof |

## Related

- [zero-capital-cold-start-checklist.md](zero-capital-cold-start-checklist.md)
- [staged-exchange-operator-runbook.md](staged-exchange-operator-runbook.md)
- [../v0/r4-client-kernel-audit.md](../v0/r4-client-kernel-audit.md)
- [../index.md](../index.md) — five-minute verify

← [Runbooks](README.md) · [Docs index](../index.md)
