/**
 * Every query key in one place, so a write in one domain can invalidate
 * another's cache (a deleted Category takes its Transactions with it) without
 * the domain modules importing each other.
 *
 * Keys are prefixes of each other on purpose: invalidating `taskKeys.all`
 * covers every Project's list and the all-Tasks list.
 */
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
