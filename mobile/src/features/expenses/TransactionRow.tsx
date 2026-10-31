import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import type {
  CategoryResponse,
  TransactionResponse,
} from "@personal/shared/generated/api";

import { fonts, makeStyles, useTheme } from "../../theme";
import { NamedIcon } from "../../ui/NamedIcon";

type TransactionRowProps = {
  transaction: TransactionResponse;
  /** The transaction's category, when it has one. */
  category: CategoryResponse | undefined;
};

/** One transaction: title, description and category, with a signed amount; a tap edits it. */
export function TransactionRow({ transaction, category }: TransactionRowProps) {
  const { colors, common } = useTheme();
  const styles = useStyles();
  // A system entry (no kind) carries its own sign; others are signed by kind.
  const isSystem = transaction.kind === null;
  const income = transaction.kind === "income";
  const amountText = isSystem
    ? `${transaction.amount.startsWith("-") ? "−" : "+"}${transaction.amount.replace(/^-/, "")}`
    : income
      ? `+${transaction.amount}`
      : `−${transaction.amount}`;
  const amountColor = isSystem
    ? colors.muted
    : income
      ? colors.income
      : colors.expense;
  return (
    <Pressable
      style={common.row}
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
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{transaction.title}</Text>
        {transaction.description !== "" && (
          <Text style={common.muted} numberOfLines={2}>
            {transaction.description}
          </Text>
        )}
        {isSystem ? (
          <Text style={common.muted}>Wpis systemowy</Text>
        ) : category ? (
          <View style={styles.category}>
            <NamedIcon
              name={category.icon}
              fallback={DEFAULT_CATEGORY_ICON}
              size={14}
              color={colors.muted}
            />
            <Text style={common.muted}>{category.name}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>{amountText}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  title: { fontSize: 14, fontWeight: "500", color: colors.ink },
  category: { flexDirection: "row", alignItems: "center", gap: 4 },
  amount: {
    fontFamily: fonts.utility,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
}));
