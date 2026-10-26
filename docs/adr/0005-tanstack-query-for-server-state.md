# Keyset-paged transactions, cached on the web with TanStack Query

`GET /api/v1/transactions/?wallet=` returned every Transaction in the Wallet, and the web kept them all in a hand-written Zustand store (`packages/shared/src/stores/transactions.ts`) with its own load guard, error state and post-write list surgery. That gets slow as a Wallet grows, and every domain store repeats the same fetch/cache code.

`transactions_list` now returns one page, `{ items, next_cursor }`, ordered by `(date DESC, id DESC)`. It takes `limit` (default 50, max 200) and an opaque `cursor`: URL-safe base64 of `date|id` for the last row of the previous page. The next page is `WHERE (date, id) < (:date, :id)`. A composite index `ix_transactions_wallet_id_date_id` on `(wallet_id, date, id)` replaces the single-column `wallet_id` index, which is its leading prefix (migration `0012`). The MCP `list_transactions` tool returns the same page and takes the same `limit`/`cursor`.

On the web, the transaction list is the first domain moved to TanStack Query (`@tanstack/react-query`). One `QueryClient` (`frontend/src/queryClient.ts`) is provided in the root route. `frontend/src/queries/transactions.ts` holds `useWalletTransactions` (a `useInfiniteQuery` keyed `["transactions", "wallet", id]`) and the `useSaveTransaction`/`useDeleteTransaction` mutations. `WalletView` loads more pages through a "Wczytaj więcej" button and an `IntersectionObserver` sentinel for infinite scroll.

Status: accepted

Considered Options:

- **Offset pagination (`?page=` / `?offset=`)**: rejected. A Transaction added or deleted between requests shifts every later page, which skips or repeats rows, and Postgres reads and discards `offset` rows on each request.
- **Keyset on `date` alone**: rejected. Many Transactions share a date, so `id` is needed as a tiebreaker to make the order total.
- **A transparent cursor (`?after_date=&after_id=`)**: rejected. An opaque one lets the sort key change without breaking clients.
- **Keep the Zustand store and add paging to it**: done only for mobile, for now (first page plus "Pokaż więcej"). On the web it would have meant one more hand-written cache. TanStack Query gives caching, request de-duplication, cancellation, refetch on focus and infinite pages for free.
- **Invalidate the list after every mutation**: rejected for create/update/delete. Refetching an infinite query reloads every loaded page in sequence. The mutations write the server's response into the cached pages instead: a row goes where the server would sort it, or is left for its page when it sorts after the last loaded row and more pages exist. Keyset cursors are keys, not offsets, so that edit never causes a gap or duplicate on later pages. Invalidation is used where the client cannot know the new row: a Wallet balance correction (`WalletEditModal`) invalidates that Wallet's list.

Consequences:

- The Wallet's balance and count still come from the Zustand wallets store. The transaction mutations call `refreshWallets` on success, as the old store's callers did.
- `renderApp` clears the query cache and turns off retries, so tests start clean and mocked failures show at once.
- Server state now lives in two places on the web: TanStack Query for transactions, Zustand for everything else. Moving the other domains (projects, tasks, time entries, counters, wallets, categories) is a follow-up, done one domain at a time if this pattern holds up. Their stores live in `@personal/shared` and serve mobile too, so that move should also decide whether mobile adopts TanStack Query (it runs on React Native), so the logic stays in one place.
- Checked on Postgres 17 with 200k rows in 20 Wallets: the first page and a later page (`(date, id) < (…)` as the index condition) are both one `Index Scan Backward using ix_transactions_wallet_id_date_id`, about 0.1 ms, with `user_id` as a filter on the 51 rows read.
