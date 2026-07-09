# In-app help sync

Maps user-facing help in the official client to maintainer documentation in the repo.

## Source of truth

| Layer | Location | Audience |
| --- | --- | --- |
| **In-app help** | `apps/web/lib/help/articles.ts` + `/help` routes | End users of the official client |
| **UI spec** | `docs/frontend-spec.md` | Maintainers implementing UI |
| **Phase plans** | `docs/frontend-phase*.md` | Release scope and acceptance |
| **Protocol / ops** | `docs/runbooks/`, `docs/specs/` | Operators and kernel work |

End users should not need to read `/docs` in git. Maintainers should not duplicate long protocol prose inside the app.

## Article map

| `/help` slug | In-app title | Repo counterparts |
| --- | --- | --- |
| `deal-flow` | How a deal works | [frontend-spec.md](../frontend-spec.md) Publish & transact slice, [testing-without-users.md](testing-without-users.md) |
| `disputes` | Disputes and settlement | [foundation/market-operating-model.md](../foundation/market-operating-model.md), guided branch in `transaction-builder-panel.tsx` |
| `identity` | Identity and backup | [runbooks/operator-security-guide.md](../runbooks/operator-security-guide.md), [runbooks/desktop-secure-key-vault.md](../runbooks/desktop-secure-key-vault.md) |
| `node-connection` | Connecting to a node | [runbooks/operator-quickstart.md](../runbooks/operator-quickstart.md), [development-guide.md](development-guide.md) |

## When to update

Update **in-app** articles when:

- A guided step is added, renamed, or removed
- User-visible settings or backup flows change
- Plain-language disclaimers (credits ≠ money) need tightening

Update **repo** docs when:

- Protocol behavior, fixtures, or runbooks change
- Acceptance criteria or phase gates move
- Dev workflow commands change

## Adding a new help article

1. Add entry to `HELP_ARTICLES` in `apps/web/lib/help/articles.ts`.
2. Slug is included automatically in `generateStaticParams` for `/help/[slug]`.
3. Link from footer, header, or dashboard shell if broadly useful.
4. Add a row to the table above in this file.

← [Client docs](README.md)
