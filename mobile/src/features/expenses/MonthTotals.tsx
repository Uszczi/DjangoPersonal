import { Text, View } from "react-native";

import {
  formatCents,
  spendingChange,
  type MonthSummary,
} from "@personal/shared/expenseMonth";

type MonthTotalsProps = {
  summary: MonthSummary;
  /** Spent in the month before, for the change against it. */
  previousExpenseCents: number | undefined;
};

const TILE = "flex-1 rounded-lg border border-card-line bg-paper px-3 py-3";
const LABEL =
  "font-utility text-[10px] font-semibold tracking-[0.9px] text-muted";

/** The month in three tiles, like the web: spent, earned and the difference. */
export function MonthTotals({
  summary,
  previousExpenseCents,
}: MonthTotalsProps) {
  const change =
    previousExpenseCents === undefined
      ? null
      : spendingChange(summary.expenseCents, previousExpenseCents);
  const netNegative = summary.netCents < 0;

  return (
    <View className="mx-4 mt-3 flex-row gap-2">
      <View className={TILE}>
        <Text className={LABEL}>WYDATKI</Text>
        <Text
          className="font-display text-[17px] font-bold text-expense"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatCents(summary.expenseCents)}
        </Text>
        {change !== null && (
          <Text
            className={
              change > 0
                ? "mt-0.5 text-[10px] text-expense"
                : "mt-0.5 text-[10px] text-income"
            }
          >
            {change > 0 ? "▲" : "▼"} {Math.abs(change)}%
          </Text>
        )}
      </View>
      <View className={TILE}>
        <Text className={LABEL}>PRZYCHODY</Text>
        <Text
          className="font-display text-[17px] font-bold text-income"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatCents(summary.incomeCents)}
        </Text>
      </View>
      <View className={TILE}>
        <Text className={LABEL}>BILANS</Text>
        <Text
          className={
            netNegative
              ? "font-display text-[17px] font-bold text-expense"
              : "font-display text-[17px] font-bold text-income"
          }
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatCents(summary.netCents, { sign: true })}
        </Text>
      </View>
    </View>
  );
}
