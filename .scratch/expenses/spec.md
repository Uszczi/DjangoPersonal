Status: ready-for-agent

# Expenses

## Problem Statement

DjangoPersonal organizes work (Projects, Tasks, Time entries) and holds freeform documents (Whiteboards/Notatki), but has no way to track personal money. Without expenses the user cannot see where the day's money goes, review spending by category, or keep separate purses for different purposes (personal vs. shared, savings goals).

## Solution

Add an expenses domain to the existing React interface and Django Ninja API, as a new `expenses` app independent from `work`. The core units are Wallets (named purses a user creates), Transactions (a money amount with a title, date, optional description, category, and wallet), and Categories (per-user labels). A new "Wydatki" tab in the navbar opens the expenses view at `/expenses/$walletId`, following the client-side routing ADR.

## User Stories

1. As the user, I want a "Wydatki" tab in the navbar, so that expenses are a first-class part of the app.
2. As the user, I want to create a wallet with a name, so that I can separate money by purpose.
3. As the user, I want to see my wallets with their transaction counts, so that I can pick one quickly.
4. As the user, I want to switch wallets from a header select, so that the list always shows the wallet I care about.
5. As the user, I want to rename a wallet, so that its purpose stays accurate.
6. As the user, I want to delete a wallet after confirming, so that I can remove purses I no longer use.
7. As the user, I want deleting a wallet to also delete its transactions, so that no orphaned records remain.
8. As the user, I want 10 base categories created with my first wallet, so that I can categorize immediately.
9. As the user, I want to create a category by typing a name inline, so that adding a label is fast.
10. As the user, I want category names trimmed and unique case-insensitively, so that duplicates cannot sneak in.
11. As the user, I want to rename a category, so that labels stay accurate.
12. As the user, I want to delete a category, so that I can remove labels I no longer use.
13. As the user, I want deleting a category to also delete its transactions, so that no orphaned records remain.
14. As the user, I want to add a transaction with a title, amount, date, and optional description and category, so that I record spending.
15. As the user, I want the transaction amount to be a positive decimal with at most 2 places, so that money is recorded accurately.
16. As the user, I want to see transactions grouped by date, so that I can review each day.
17. As the user, I want to edit a transaction in a modal, so that I can correct mistakes.
18. As the user, I want to delete a transaction, so that I can remove wrong entries.
19. As the user, I want the selected wallet in the URL, so that a wallet view is bookmarkable and survives a reload.
20. As the user, I want an unknown or deleted wallet URL to redirect to the wallet list, so that stale links do not dead-end.
21. As the user, I want browser back/forward to move between wallets, so that navigation feels native.

## Implementation Decisions

- Deliver a complete vertical slice in a new `backend/apps/expenses/` app: models, migration, Django Ninja endpoints, generated TypeScript client, React UI. Models live in `backend/apps/infra/models/`; migrations via `just makemigrations` land in `backend/apps/infra/migrations/`.
- Version endpoints under `/api/v1/` following the conventions captured in the API-surface research: one `Router(tags=['personal'])` per entity, explicit `operation_id`, trailing slashes, `JWTAuth()`, standard verb status codes (201 create, 204 delete).
- Contracts in `contracts/` extending `apps.shared.base.BaseModel`, with `XRequest` / `PatchedXRequest` / `XResponse` naming; a private `_XPpayload` base for normalization; `apply_provided` for PATCH semantics.
- Handlers raise `DomainError` / `NotFound` from `apps.shared.errors`; repository errors from `infra/repo/errors.py` are translated in handlers; the shared HTTP adapter maps them to `{detail: message}` with status codes.
- Regenerate the OpenAPI schema and TypeScript client with `just generate-api`; consume through the `api` singleton in a Zustand store.
- A Wallet has a required name (trimmed, unique case-insensitively per user) and owns its Transactions. No default wallet — the user creates the first one.
- A Category has a required name (trimmed, unique case-insensitively per user). The system seeds 10 base categories when the user creates their first wallet.
- A Transaction has a required title, a required amount (Decimal, positive, at most 2 decimal places), a required date, an optional description, an optional Category (nullable), and a required Wallet.
- Deleting a wallet cascades to its transactions; deleting a category also cascades to its transactions. Both operations require confirmation in the UI.
- A transaction belongs to the calendar day its date falls on; overnight entries are reported on the day they began.
- The expenses view lives at `/expenses` (wallet list) and `/expenses/$walletId` (a wallet's transactions). The selected wallet is part of the main URL path; category is internal view state only. Browser back/forward moves between wallets. A URL naming a deleted or unknown wallet redirects to `/expenses`.
- The transaction list is grouped by date; there is no pagination in v1.
- The UI follows existing patterns: a new "Wydatki" tab in the navbar, a header select to switch wallets, a sidebar panel below the wallets list for category management, and modals for wallet and transaction create/edit.

## Testing Decisions

- Backend: pytest with pytest-django and Django's test client, in `backend/tests/test_expenses_api.py`. Cover wallet CRUD and name rules, category CRUD and name rules, the 10-seed-categories trigger on first wallet creation, transaction CRUD and amount validation, cascade deletes, and per-user isolation. Tests control the server clock instead of sleeping.
- Frontend: Vitest and React Testing Library with fetch mocked at the network boundary, extending the existing App tests. Cover the Wydatki tab, the wallet list and switch, the category manager, the transaction list grouped by date, the create/edit modals, and the redirect for a deleted wallet URL.
- Tests verify externally observable behavior over internal implementation details.

## Out of Scope

- Income and transfers between wallets.
- Multi-currency (single currency for now; a wallet carries a name only).
- Default/auto-created wallet.
- Budgets, reports, recurring transactions, transaction pagination.
- Sums or aggregates on the wallet list.
- Time-entry-style loose coupling with task completion — expenses are independent of `work`.

## Further Notes

- The domain terms `Wallet`, `Transaction`, and `Category` are recorded in the repository glossary.
- This spec does not prescribe concrete API URLs or response payload formats beyond the conventions above; those should be designed while implementing the API seam.
- All five decision tickets in `.scratch/expenses/map.md` are resolved; the way to this spec is clear.
