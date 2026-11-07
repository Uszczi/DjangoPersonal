import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import { formatCents, signedCents } from "@personal/shared/expenseMonth";
import type {
  CategoryResponse,
  TransactionResponse,
} from "@personal/shared/generated/api";

import { useTheme } from "@/theme";
import { NamedIcon } from "@/ui/NamedIcon";

const shortDay = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
});

type TransactionRowProps = {
  transaction: TransactionResponse;
  /** The transaction's category, when it has one. */
  category: CategoryResponse | undefined;
  /** The wallet's name, when the list mixes wallets. */
  walletName?: string;
};

/** One transaction, like the web: the day, its category mark, the title and a signed amount; a tap edits it. */
export function TransactionRow({
  transaction,
  category,
  walletName,
}: TransactionRowProps) {
  const { colors } = useTheme();
  // A system entry (no kind) carries its own sign; others are signed by kind.
  const isSystem = transaction.kind === null;
  const income = transaction.kind === "income";
  const amountText = formatCents(signedCents(transaction), { sign: true });
  const subtitle = [
    walletName,
    isSystem ? "Wpis systemowy" : transaction.description,
  ]
    .filter(Boolean)
    .join(" · ");
  const amountClass = isSystem
    ? "font-utility text-[13px] font-semibold text-muted tabular-nums"
    : income
      ? "font-utility text-[13px] font-semibold text-income tabular-nums"
      : "font-utility text-[13px] font-semibold text-expense tabular-nums";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edytuj transakcję: ${transaction.title}`}
      onPress={() =>
        router.push({
          pathname: "/transaction",
          params: {
            walletId: transaction.walletId,
            transactionId: transaction.id,
          },
        })
      }
      className="mx-4 min-h-[62px] flex-row items-center gap-2 border-b border-row-line px-[3px] py-2.5 active:bg-wash"
    >
      <Text className="w-12 shrink-0 font-utility text-[12px] text-muted">
        {shortDay.format(transaction.date)}
      </Text>
      <View className="size-7 shrink-0 items-center justify-center rounded-full bg-icon-wash">
        {category && (
          <NamedIcon
            name={category.icon}
            fallback={DEFAULT_CATEGORY_ICON}
            size={14}
            color={colors.icon}
          />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm text-ink" numberOfLines={1}>
          {transaction.title}
        </Text>
        {subtitle !== "" && (
          <Text className="text-[11px] text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Text className={amountClass}>{amountText}</Text>
    </Pressable>
  );
}
