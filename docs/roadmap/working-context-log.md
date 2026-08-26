# Working Context Log

Purpose: preserve **current** implementation context across sessions. Historical log (July–August 2026): [../archive/roadmap/working-context-log-historical.md](../archive/roadmap/working-context-log-historical.md).

Last updated: August 2026

## Current snapshot

- **Phase:** Core client + kernel **shipped** for maintainer-invite cohort. R10 maintainer bar met (`PRG-1`..`PRG-4`).
- **Canonical status:** [../project-status.md](../project-status.md)
- **Next atomic step:** Documentation consolidation complete; pick non-people-gated polish (design audit P2) or product gaps (provider landing, pro-bono policy doc).
- **`PRG-5` deferred** — no human counterparty; not a project hold.

## Recently shipped (client)

- Global search palette (`Ctrl/⌘+K`, `/` outside `/help`) — pages, settings, help, lanes
- Settings category deep links (`?category=profile|connection|security`)
- Keyboard back shortcut (`Alt+←`, `Ctrl/⌘+[`)
- Marketplace UX: unified primary accent, trust disclosure consolidation, lane/status icons, help docs layout

## Key paths

| Area | Path |
| --- | --- |
| Global search | `apps/web/components/search/global-search.tsx` |
| Search catalog | `apps/web/lib/search/global-search-items.ts` |
| Client capabilities doc | `docs/client/client-capabilities.md` |
| Deal loop smoke | `scripts/desktop-deal-loop-smoke.mjs` |

## Verification habit

```bash
pnpm stability:pack:quick
cd apps/web && pnpm typecheck
```

## Operator data dirs

- Production R2 evidence: `./.data/r2`
- Zero-capital preferred: `./.data/zc1`
- Fresh experiments: `./.data/default`

← [Project status](../project-status.md) · [Docs index](../index.md)
