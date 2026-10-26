/**
 * A wallet's keyset-paged transaction list as the clients hold it: the
 * server's order, and where a saved transaction goes among the loaded rows.
 * Shared by the web (TanStack Query pages) and the transactions store.
 */
import type { TransactionResponse } from "./generated/api";

/** Shown when a page of transactions cannot be loaded. */
export const TRANSACTIONS_LOAD_ERROR = "Nie udało się wczytać transakcji. Spróbuj ponownie.";

/** Server order: `(date, id)` descending. Negative when `a` comes first. */
export function compareNewestFirst(a: TransactionResponse, b: TransactionResponse) {
  return b.date.getTime() - a.date.getTime() || b.id - a.id;
}

/**
 * The loaded rows with `transaction` placed where the server would list it.
 * One older than every loaded row while more pages exist (`hasMore`) is left
 * out: the keyset cursor (a key, not an offset) brings it in with its own
 * page, with no gap or duplicate.
 */
export function withPlaced(
  loaded: TransactionResponse[],
  transaction: TransactionResponse,
  hasMore: boolean,
): TransactionResponse[] {
  const rest = loaded.filter((item) => item.id !== transaction.id);
  const last = rest[rest.length - 1];
  if (hasMore && last && compareNewestFirst(transaction, last) > 0) return rest;
  return [...rest, transaction].sort(compareNewestFirst);
}
