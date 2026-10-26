import { useEffect, useRef } from "react";

import { CategoryIcon } from "@/components/CategoryIcon";
import { TransactionEditorModal } from "@/components/modals/TransactionEditorModal";
import { WalletEditModal } from "@/components/modals/WalletEditModal";
import { WalletMark } from "@/components/WalletMark";
import { WalletSelect } from "@/components/WalletSelect";
import {
  Button,
  ErrorMessage,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import { type TransactionResponse, type WalletResponse } from "@personal/shared/generated/api";
import { ShowModal } from "@/stores/modal";
import { useCategoriesStore } from "@personal/shared/stores/categories";
import { useWalletTransactions } from "@/queries/transactions";

const dayFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** The calendar day a (local-midnight) wire date stands for, as `yyyy-mm-dd`. */
function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Group consecutive transactions by their calendar day, preserving order. */
function groupByDay(
  transactions: TransactionResponse[],
): [string, TransactionResponse[]][] {
  const groups = new Map<string, TransactionResponse[]>();
  for (const transaction of transactions) {
    const key = dayKey(transaction.date);
    const day = groups.get(key) ?? [];
    day.push(transaction);
    groups.set(key, day);
  }
  return [...groups.entries()];
}

/**
 * Calls `onReach` whenever the returned element scrolls into view, for
 * infinite scrolling. A change of `loaded` (the rows shown) observes it afresh,
 * and observing reports the current visibility: if the element is still in
 * view after a page loads (short pages, tall screen), `onReach` fires again
 * instead of waiting for a scroll that cannot happen. Without
 * IntersectionObserver the button still works.
 */
function useOnScrolledIntoView(onReach: () => void, enabled: boolean, loaded: number) {
  const ref = useRef<HTMLDivElement>(null);
  const onReachRef = useRef(onReach);
  useEffect(() => {
    onReachRef.current = onReach;
  });
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onReachRef.current();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, loaded]);
  return ref;
}

/** One wallet: the switcher, its name (opening the edit modal) and its transactions grouped by day. */
export function WalletView({ wallet }: { wallet: WalletResponse }) {
  const categories = useCategoriesStore((state) => state.categories);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const {
    data: transactions = [],
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useWalletTransactions(wallet.id);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };
  const endOfList = useOnScrolledIntoView(loadMore, hasNextPage, transactions.length);
  const groups = groupByDay(transactions);

  return (
    <section aria-label={`Portfel: ${wallet.name}`}>
      <WalletSelect activeWalletId={wallet.id} />

      <div className="mt-4 mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label={`Edytuj portfel: ${wallet.name}`}
          onClick={() => ShowModal(WalletEditModal, { wallet })}
          className="flex min-w-0 items-center gap-2 rounded px-1 text-left hover:bg-wash"
        >
          <WalletMark wallet={wallet} />
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
            {wallet.name}
          </h2>
          {wallet.balance != null && (
            <span className="font-utility text-[13px] font-semibold text-ink-soft">
              {wallet.balance}
            </span>
          )}
        </button>
        <Button
          variant="primary"
          onClick={() =>
            ShowModal(TransactionEditorModal, { walletId: wallet.id })
          }
        >
          <span aria-hidden="true">+</span>
          Nowa transakcja
        </Button>
      </div>

      {isError && (
        <ErrorMessage>Nie udało się wczytać transakcji. Spróbuj ponownie.</ErrorMessage>
      )}

      {groups.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">Brak transakcji. Dodaj pierwszą transakcję.</p>
      ) : (
        groups.map(([day, dayTransactions]) => (
          <section className="mb-6" key={day}>
            <h3 className="mb-2 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
              {dayFormatter.format(dayTransactions[0].date)}
            </h3>
            <ul
              className="flex flex-col"
              aria-label={`Transakcje z dnia ${dayFormatter.format(dayTransactions[0].date)}`}
            >
              {dayTransactions.map((transaction) => {
                const category = transaction.categoryId
                  ? categories.find((item) => item.id === transaction.categoryId)
                  : undefined;
                return (
                  <ListRow key={transaction.id}>
                    <ListRowButton
                      aria-label={`Edytuj transakcję: ${transaction.title}`}
                      onClick={() =>
                        ShowModal(TransactionEditorModal, {
                          walletId: wallet.id,
                          transaction,
                        })
                      }
                    >
                      <div className="min-w-0">
                        <ListRowTitle>{transaction.title}</ListRowTitle>
                        {transaction.description && (
                          <ListRowSubtitle multiline>{transaction.description}</ListRowSubtitle>
                        )}
                        {category && (
                          <ListRowSubtitle>
                            <span className="inline-flex items-center gap-1">
                              <CategoryIcon icon={category.icon} className="size-3.5" />
                              {category.name}
                            </span>
                          </ListRowSubtitle>
                        )}
                      </div>
                    </ListRowButton>
                    <span className="font-utility text-[13px] font-semibold text-ink">
                      {transaction.amount}
                    </span>
                  </ListRow>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {hasNextPage && (
        <div ref={endOfList} className="flex justify-center py-4">
          <Button variant="secondary" onClick={loadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Wczytywanie…" : "Wczytaj więcej"}
          </Button>
        </div>
      )}
    </section>
  );
}
