Status: complete

# Expenses domain — wayfinder map

## Destination

A complete spec for the expenses domain in DjangoPersonal — Wallets, Transactions, and Categories — delivered as `.scratch/expenses/spec.md` with numbered implementation issues, ready for an agent session to build. Expenses are independent of the `work` app (projects, tasks, time).

## Notes

- Domain: personal finance tracking — the money a person spends, grouped into wallets and organized by categories.
- Skills every session should consult: grilling, domain-modeling.
- Standing preferences: follow existing repo patterns — Django Ninja API under `/api/v1/`, generated OpenAPI TypeScript client, React UI, vertical slices, pytest + Vitest. UI language: Polish. Domain terms land in `GLOSSARY.md` as they crystallize.
- The local-markdown issue tracker is used (`.scratch/<effort>/`); a ticket is claimed by setting `Status: claimed` before any work.

## Settled during charting

- Destination shape: spec first, implementation issues after (like every other domain).
- Scope: expenses only. Income, transfers between wallets, and multi-currency are out of scope for now.
- Wallets: many per user, **no default wallet** — the user creates the first one.
- Currency: per wallet eventually; for now a wallet carries a name only.
- Categories: per user; the system seeds 10 base categories when the user creates their first wallet; users get full CRUD on categories.
- Transactions: title, amount (Decimal, positive, 2 decimal places), date, optional description, category (nullable), wallet.
- Deletion: deleting a wallet cascades to its transactions; deleting a category also cascades — its transactions are deleted (confirmed change during 03-categories-ui).
- Independent from `work` — no Project/Task links.
- UI: a new "Wydatki" tab in the navbar with its own route, following ADR-0001 (client-side routing). URL: `/expenses/$walletId`.
- All five decision tickets resolved; the map is ready to be written into `.scratch/expenses/spec.md`.

## Decisions so far

- [01-api-surface](issues/01-api-surface.md): repo API conventions captured — vertical slice in `backend/apps/expenses/`, `/api/v1/` with Django Ninja, Pydantic contracts, shared `DomainError` adapter, `just generate-api`, Zustand store consuming generated client. Findings on branch `research/expenses-api-surface`.
- [02-wallets-ui](issues/02-wallets-ui.md): wallet list shows name + count, modal create, header select to switch, cascade confirm delete, same select on mobile.
- [03-categories-ui](issues/03-categories-ui.md): sidebar panel below wallets, inline create, trim + case-insensitive unique names, 10 seed categories, cascade delete.
- [04-transactions-ui](issues/04-transactions-ui.md): list grouped by date, create/edit via modal, Decimal amount without currency, responsive same list, no pagination yet.
- [05-routing-integration](issues/05-routing-integration.md): URL is `/expenses/$walletId` (wallet in main path), deleted wallet redirects to `/expenses`, only wallet in URL, back/forward works.

## Not yet specified

- The API surface details (endpoint shapes, payloads) — follows the conventions captured in 01-api-surface; sharp enough to write directly into the spec.

## Implementation

Built from `spec.md` as three sequential tickets; each is resolved in place with an Answer.

- [01-wallets](issues/01-wallets.md): **resolved** — Wallet CRUD + list, header select, per-user name rules. `transaction_count` is `0` until ticket 03.
- [02-categories](issues/02-categories.md): **resolved** — Category CRUD, sidebar panel (inline create/rename, cascade delete confirm), 10 base categories seeded (merged) on first wallet.
- [03-transactions](issues/03-transactions.md): pending.

## Out of scope

- Income and transfers between wallets.
- Multi-currency (single currency for now).
- Default/auto-created wallet.
- Budgets, reports, recurring transactions.
