# 03: Transactions — CRUD + list + modal

**What to build:** The user can record, edit, and delete transactions for the selected wallet. Transactions are shown grouped by date. Creating and editing happens in a modal with title, amount, date, description, category, and wallet fields. Amount is a positive Decimal with at most 2 decimal places.

**Blocked by:** 01 — Wallets CRUD + list, 02 — Categories CRUD + seed + sidebar (transactions reference both).

**Status:** resolved

- [x] The user can add a transaction via a modal (title, amount, date, description, category, wallet)
- [x] The user can edit a transaction in a modal
- [x] The user can delete a transaction after confirming
- [x] The transaction list is grouped by date
- [x] Amount is validated: positive Decimal, at most 2 decimal places
- [x] The transaction shows title, amount, date, description, and category
- [x] Backend API endpoints under `/api/v1/transactions/` with full CRUD
- [x] TypeScript client regenerated from the schema
- [x] Backend tests cover CRUD, amount validation, date handling, and per-user isolation
- [x] Frontend tests cover the grouped list, create modal, edit modal, delete, and amount validation

## Answer

Transactions CRUD + grouped list + modals is implemented, completing the expenses domain.

**Backend** (`backend/apps/expenses/`, mirrors the wallet/category slices): `Transaction` model (`apps/infra/models/transaction.py`, `Decimal` amount with `max_digits`/`decimal_places` enforcing at most 2 places, `PositiveDecimal`-style validation, `DateField`, optional `description`, nullable `category` FK, required `wallet` FK), `TransactionRepository`, migration `0011_transaction`. Django Ninja router exposes `GET/POST /api/v1/transactions/` (list scoped to a wallet, newest-first) and `GET/PUT/PATCH/DELETE /api/v1/transactions/{id}/` under JWT auth. Amount positivity and 2-decimal rules surface as `DomainError`; a foreign wallet/category or a missing transaction as `DomainError`/`NotFound`. `DeleteWallet` and `DeleteCategory` now truly cascade to transactions at the database level, and the wallet list annotates the real `transaction_count` (closing the ticket-01 deferral).

**Frontend**: `src/stores/transactions.ts` (Zustand; `saveTransaction` converts the form's wire date string to a `Date` via the client's `parseDate` before the API call, matching the generated `TransactionRequest.date: Date`), `TransactionEditorModal` (create + edit; `noValidate` so the JS amount/date/title checks own validation), `DeleteTransactionModal` (confirm), and the `$walletId` route renders the list grouped by calendar day (`Intl.DateTimeFormat('pl-PL')`) with per-row edit/delete buttons. The amount field is `type="text"` + `inputMode="decimal"` so the typed decimal (e.g. `34.90`) is preserved exactly rather than normalized by a number input.

**Testing**: 20 backend API tests (`tests/test_transactions_api.py`) cover CRUD, amount positivity and 2-decimal limits, title/date required, wallet-scoped newest-first listing, cross-wallet moves, PUT clearing the category, per-user isolation (read + mutations), cascade delete (wallet and category), the real `transaction_count`, and the versioned schema. 5 frontend tests (`tests/Transactions.test.tsx`) cover the grouped list (title, amount, description, category per day), the create modal (POST body + list update), the edit modal (PATCH body + list update), delete-with-confirm, and amount validation — fetch mocked at the network boundary, routed by URL.

**Root-cause note (create failing initially):** the store passed `date` as the wire string, but the generated client's `serializeDate` calls `.getTime()` on a `Date`, so `transactionsCreate` threw `value.getTime is not a function` before any POST. `toRequest` fixes it by parsing the string to a local-midnight `Date` first (consistent with `parseDate`).
