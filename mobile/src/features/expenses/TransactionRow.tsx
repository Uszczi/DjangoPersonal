import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import type {
  CategoryResponse,
  TransactionResponse,
} from "@personal/shared/generated/api";

import { useTheme } from "../../theme";
import { common } from "../../ui/classes";
import { NamedIcon } from "../../ui/NamedIcon";

type TransactionRowProps = {
  transaction: TransactionResponse;
  /** The transaction's category, when it has one. */
  category: CategoryResponse | undefined;
};

/** One transaction: title, description and category, with a signed amount; a tap edits it. */
export function TransactionRow({ transaction, category }: TransactionRowProps) {
  const { colors } = useTheme();
  // A system entry (no kind) carries its own sign; others are signed by kind.
  const isSystem = transaction.kind === null;
  const income = transaction.kind === "income";
  const amountText = isSystem
    ? `${transaction.amount.startsWith("-") ? "−" : "+"}${transaction.amount.replace(/^-/, "")}`
    : income
      ? `+${transaction.amount}`
      : `−${transaction.amount}`;
  const amountClass = isSystem
    ? "font-utility text-sm font-semibold text-muted tabular-nums"
    : income
      ? "font-utility text-sm font-semibold text-income tabular-nums"
      : "font-utility text-sm font-semibold text-expense tabular-nums";
  return (
    <Pressable
      className={common.row}
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
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-medium text-ink">
          {transaction.title}
        </Text>
        {transaction.description !== "" && (
          <Text className={common.muted} numberOfLines={2}>
            {transaction.description}
          </Text>
        )}
        {isSystem ? (
          <Text className={common.muted}>Wpis systemowy</Text>
        ) : category ? (
          <View className="flex-row items-center gap-1">
            <NamedIcon
              name={category.icon}
              fallback={DEFAULT_CATEGORY_ICON}
              size={14}
              color={colors.muted}
            />
            <Text className={common.muted}>{category.name}</Text>
          </View>
        ) : null}
      </View>
      <Text className={amountClass}>{amountText}</Text>
    </Pressable>
  );
}
