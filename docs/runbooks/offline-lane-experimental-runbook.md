# Offline Lane Experimental Runbook (R6-L3)

Purpose: keep offline lane templates (`local-resource-exchange`, `physical-handoff`) verifiable and explicitly experimental, without promoting them to deployment gates.

Last updated: July 2026

## Scope

- `local-resource-exchange` (`deliveryMode: local-community`, evidence `local-resource-receipt-v1`)
- `physical-handoff` (`deliveryMode: in-person`, evidence `physical-handoff-ack-dual-v1`)

These lanes are **not** part of R2 proof gates and should not be sold as production-grade fairness guarantees.

## Verification loop

Run the dedicated smoke bundle:

```bash
npm run r6:offline-lanes:smoke
```

This validates:

1. Deterministic rejection of offline lane template mismatches
2. Offline lane telemetry math and alert derivation
3. Fixture replay coverage including SCN-18 (`marketplace-physical-handoff-accept.jsonl`)

## Operator usage policy

- Prefer digital artifact lanes for first community deployments
- Keep offline lanes opt-in via policy packs and explicit community governance
- Require explicit lane/evidence matching in offers and milestones
- Treat `notesHash` and artifact hashes as procedure evidence only, not objective proof of physical transfer quality

## Known constraints

- No kernel-level subjective arbitration for physical handoff quality
- No fiat rails, no platform-admin override path
- Local resource and in-person trust assumptions remain community-level social contracts

## Related docs

- `docs/architecture/lane-template-catalog.md`
- `docs/runbooks/community-lane-templates-runbook.md`
- `docs/foundation/platform-vision-exploration.md`
