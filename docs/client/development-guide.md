# Client development guide

How to run and iterate on the official Vectis client (`apps/web`) against a local or remote node.

## Prerequisites

- Node.js 20+ and `pnpm`
- Rust toolchain (for `vectis-node` / `cargo run`)
- Repo root: `E:/Experimental projects/vectis` (adjust paths locally)

## Quick start (web)

```bash
# Terminal 1 — node API (default http://127.0.0.1:7878)
cargo run --bin vectis-node -- serve --data-dir ./.data/dev

# Terminal 2 — web client
cd apps/web
pnpm install
pnpm dev
```

The dev script picks an available port (see `scripts/ensure-dev-web-port.mjs`). Open the URL printed in the terminal.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_NODE_API_BASE_URL` | Node base URL the browser calls (default `http://127.0.0.1:7878`) |
| `NEXT_PUBLIC_VECTIS_MOCK_MODE` | When `1`, marketplace may show showcase listings if node is empty |

## Common routes

| Route | Purpose |
| --- | --- |
| `/marketplace` | Browse listings |
| `/dashboard` | Overview workspace |
| `/dashboard/builder` | Guided publish & transact |
| `/dashboard/transactions` | Live order queue |
| `/help` | In-app user guides |
| `/explorer` | Kernel inspection tools |

## Verification before push

```bash
cd apps/web && pnpm typecheck
npm run r4:client-audit    # from repo root — kernel boundary checks
```

## Desktop (Tauri)

```bash
pnpm dev:desktop           # sidecar + web shell
pnpm verify:desktop        # cargo check + audit + web build
```

See [../runbooks/desktop-release-build.md](../runbooks/desktop-release-build.md) for installers.

## Where UI logic lives

| Area | Primary files |
| --- | --- |
| Guided deal flow | `components/dashboard/transaction-builder-panel.tsx`, `app/components/marketplace-event-builder.tsx` |
| Order action hub | `components/marketplace/order-action-hub.tsx` |
| Transactions queue | `lib/dashboard/load-transactions.ts`, `lib/dashboard/transaction-progress.ts` |
| User help | `lib/help/articles.ts`, `app/help/**` |
| Settings / identity | `components/dashboard/dashboard-settings-panel.tsx` |

## Docs discipline

When user-visible behavior changes:

1. Update [../frontend-spec.md](../frontend-spec.md) or phase plan if acceptance criteria shift.
2. Update in-app help in `apps/web/lib/help/articles.ts`.
3. Note the change in [in-app-help-sync.md](in-app-help-sync.md) if article scope moved.

← [Client docs](README.md)
