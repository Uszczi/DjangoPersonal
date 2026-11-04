/**
 * A wallet's transactions as the clients hold them: the server's order and
 * the load-failure message.
 */
import type { TransactionResponse } from "./generated/api";
import { compareIds } from "./ids";

/** Shown when a wallet's transactions cannot be loaded. */
export const TRANSACTIONS_LOAD_ERROR = "Nie udało się wczytać transakcji. Spróbuj ponownie.";

/** Server order: `(date, id)` descending. Negative when `a` comes first. */
export function compareNewestFirst(a: TransactionResponse, b: TransactionResponse) {
  return b.date.getTime() - a.date.getTime() || compareIds(b.id, a.id);
}
