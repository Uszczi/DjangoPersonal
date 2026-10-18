Status: active

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
- Deletion: deleting a wallet cascades to its transactions; deleting a category leaves its transactions with no category.
- Independent from `work` — no Project/Task links.
- UI: a new "Wydatki" tab in the navbar with its own route, following ADR-0001 (client-side routing).

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

## Not yet specified

- API surface: endpoint shapes, filters, payload formats, error codes for wallets, transactions, and categories.
- UI flows: transaction list/create/edit/delete screens, wallet management, category management, mobile behaviour.
- The final list of the 10 seed categories.
- Transaction list filtering, sorting, and pagination.
- How the expenses route integrates with the existing client-side routing (URL shape, deep-linking, back/forward).

## Out of scope

- Income and transfers between wallets.
- Multi-currency (single currency for now).
- Default/auto-created wallet.
- Budgets, reports, recurring transactions.
