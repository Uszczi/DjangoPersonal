/**
 * Every query key in one place, so a write in one domain can invalidate
 * another's cache (a deleted Category takes its Transactions with it) without
 * the domain modules importing each other.
 *
 * Keys are prefixes of each other on purpose: invalidating `taskKeys.all`
 * covers every Project's list and the all-Tasks list.
 */
import type { QueryKey } from "@tanstack/react-query";

import {
  ITEM_KINDS,
  ITEM_STATUSES,
  type ItemKind,
  type ItemStatus,
} from "../bibliographyFormat";

/** The account's settings (the theme). */
export const settingsKeys = {
  all: ["settings"] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
};

export const projectKeys = {
  all: ["projects"] as const,
};

export const taskKeys = {
  all: ["tasks"] as const,
  project: (projectId: number) => ["tasks", "project", projectId] as const,
  /** Every Task of every Project, for the timer's task picker. */
  everything: ["tasks", "everything"] as const,
};

export const timerKeys = {
  timer: ["timer"] as const,
  entries: ["timeEntries"] as const,
};

export const walletKeys = {
  all: ["wallets"] as const,
};

export const transactionKeys = {
  all: ["transactions"] as const,
  wallet: (walletId: number) => ["transactions", "wallet", walletId] as const,
};

export const counterKeys = {
  all: ["counters"] as const,
  entries: (counterId: number) => ["counterEntries", counterId] as const,
};

/** Which BibliographyItems a list shows; a missing filter means all. */
export type BibliographyItemFilters = { status?: ItemStatus; kind?: ItemKind };

export const bibliographyItemKeys = {
  /** Every list and every single item. */
  all: ["bibliographyItems"] as const,
  /** Every cached list, whatever its filters. */
  lists: ["bibliographyItems", "list"] as const,
  /** The list narrowed by status and kind; `{}` is every item. */
  list: (filters: BibliographyItemFilters) =>
    ["bibliographyItems", "list", filters] as const,
  /** One item, as the retrieve endpoint returns it. */
  detail: (itemId: number) => ["bibliographyItems", "detail", itemId] as const,
  /** One item's Attempts. */
  attempts: (itemId: number) => ["bibliographyAttempts", itemId] as const,
  /** Every Attempt of the user, on any item (the year view). */
  allAttempts: ["bibliographyAttempts", "all"] as const,
};

/** The filters a cached list was loaded with, read back from its `list` key. */
export function bibliographyListFilters(
  queryKey: QueryKey,
): BibliographyItemFilters {
  const filters = queryKey[2];
  if (typeof filters !== "object" || filters === null) return {};
  const status = "status" in filters ? filters.status : undefined;
  const kind = "kind" in filters ? filters.kind : undefined;
  return {
    status: ITEM_STATUSES.find((known) => known === status),
    kind: ITEM_KINDS.find((known) => known === kind),
  };
}
