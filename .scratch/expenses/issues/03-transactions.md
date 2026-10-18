# 03: Transactions — CRUD + list + modal

**What to build:** The user can record, edit, and delete transactions for the selected wallet. Transactions are shown grouped by date. Creating and editing happens in a modal with title, amount, date, description, category, and wallet fields. Amount is a positive Decimal with at most 2 decimal places.

**Blocked by:** 01 — Wallets CRUD + list, 02 — Categories CRUD + seed + sidebar (transactions reference both).

**Status:** ready-for-agent

- [ ] The user can add a transaction via a modal (title, amount, date, description, category, wallet)
- [ ] The user can edit a transaction in a modal
- [ ] The user can delete a transaction after confirming
- [ ] The transaction list is grouped by date
- [ ] Amount is validated: positive Decimal, at most 2 decimal places
- [ ] The transaction shows title, amount, date, description, and category
- [ ] Backend API endpoints under `/api/v1/transactions/` with full CRUD
- [ ] TypeScript client regenerated from the schema
- [ ] Backend tests cover CRUD, amount validation, date handling, and per-user isolation
- [ ] Frontend tests cover the grouped list, create modal, edit modal, delete, and amount validation
