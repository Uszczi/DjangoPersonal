Type: task
Status: ready-for-agent
Blocked by: none

# Transactions: keyset pagination + TanStack Query

## Problem

`GET /api/v1/transactions/?wallet=` (`transactions_list`) returns every transaction in the wallet. The web store `packages/shared/src/stores/transactions.ts` keeps them all in Zustand and refetches by hand. This will get slow as data grows, and fetching/caching logic is hand-rolled.

## What to build

### Backend

- Keyset (cursor) pagination on `transactions_list`: optional `limit` (default 50, max 200) and `cursor` query params; order by `(date DESC, id DESC)`.
- Response becomes a page: `{ items: TransactionResponse[], next_cursor: string | null }`. The cursor is opaque (e.g. base64 of `date|id`).
- Composite index on `(wallet_id, date, id)` via Alembic migration; check with `EXPLAIN` on Postgres.
- Repository and HTTP tests: page boundaries, same-date ties, empty wallet, foreign wallet still 404.
- Update the API contract snapshot, `just generate-api`, and the MCP `list_transactions` tool (it may keep returning a single page with the cursor).

### Web (TanStack Query, transactions only)

- Add `@tanstack/react-query` with a `QueryClientProvider` in the root route.
- `useInfiniteQuery` for the transaction list with "load more"/infinite scroll; create/update/delete as mutations that invalidate (or optimistically update) the list.
- The wallet's balance/count must stay correct after mutations.
- Mobile keeps using the existing store for now (adapt it to the paged response, first page + "więcej").

## Acceptance criteria

- [ ] A wallet with 500 transactions loads the first 50 and fetches more on scroll.
- [ ] No duplicates or gaps across pages, including many transactions on the same date.
- [ ] Adding a transaction shows it without a full reload.
- [ ] Frontend tests in `tests/components/ExpensesPage.test.tsx` / `WalletView.test.tsx` cover paging and mutations; `just check` green.
- [ ] A short ADR in `docs/adr/` records the decision to adopt TanStack Query (and whether to roll it out to other domains).

## Learning goals

Keyset vs offset pagination, Postgres indexes and `EXPLAIN ANALYZE`, server-state caching with TanStack Query (query keys, invalidation, optimistic updates).

## Comments

**Agent (2026-10-26):** Implemented on branch `hardening-03-pagination`.

- Backend: `transactions_list` takes `limit`/`cursor` and returns `TransactionPageResponse` `{items, next_cursor}`. The cursor is base64url of `date|id`, and the keyset is a row-value comparison.
- Migration `0012` replaces `ix_transactions_wallet_id` with `(wallet_id, date, id)`.
- MCP: `list_transactions` takes `limit`/`cursor` and returns the page.
- Web: a TanStack Query infinite query with a "Wczytaj więcej" button and an IntersectionObserver sentinel. Mutations write the saved row into the cached pages and refresh the wallet. A balance correction invalidates the list.
- Mobile: the shared store loads the first page, with "Pokaż więcej" for the rest.

Postgres 17 EXPLAIN ANALYZE on 200k rows is in `docs/adr/0005-tanstack-query-for-server-state.md`: both pages run as one backward index scan, about 0.1 ms. The migration also upgrades and downgrades cleanly on Postgres.
