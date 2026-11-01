import { Pressable, Text, View } from "react-native";

import {
  dayOfMonth,
  formatCents,
  leadingBlankDays,
  WEEKDAY_LABELS,
  type MonthKey,
  type MonthSummary,
} from "@personal/shared/expenseMonth";

import { mixColor } from "@/features/expenses/mixColor";
import { useTheme } from "@/theme";
import { card } from "@/ui/classes";

type MonthCalendarProps = {
  month: MonthKey;
  summary: MonthSummary;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
};

const dayName = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
});

// Seven cells a row: a seventh of the width each, the gap inside the cell.
const CELL = "w-[14.2857%] p-0.5";

/**
 * The month as a calendar, like the web: each day tinted by how much was
 * spent on it, a dot where money came in; a day with transactions toggles
 * the list's day filter.
 */
export function MonthCalendar({
  month,
  summary,
  selectedDay,
  onSelectDay,
}: MonthCalendarProps) {
  const { colors } = useTheme();
  const days = summary.days.slice(1);
  const largest = Math.max(1, ...days.map((day) => day.expenseCents));
  const spendingDays = days.filter((day) => day.expenseCents > 0).length;
  const average = spendingDays ? summary.expenseCents / spendingDays : 0;

  return (
    <View className={card.section}>
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="font-display text-[17px] font-bold text-ink">
          Miesiąc
        </Text>
        <Text className="text-[11px] text-muted">
          {spendingDays} dni z wydatkami · śr.{" "}
          {formatCents(Math.round(average))}
        </Text>
      </View>
      <View className="flex-row flex-wrap">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} className={CELL}>
            <Text className="text-center font-utility text-[10px] text-muted">
              {label.toUpperCase()}
            </Text>
          </View>
        ))}
        {Array.from({ length: leadingBlankDays(month) }, (_, index) => (
          <View key={`blank-${index}`} className={CELL} />
        ))}
        {days.map((total, index) => {
          const day = index + 1;
          const share = total.expenseCents / largest;
          const spent = total.expenseCents > 0;
          const selected = selectedDay === day;
          const strong = share > 0.55;
          return (
            <View key={day} className={CELL}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${dayName.format(dayOfMonth(month, day))}${
                  spent ? `: wydano ${formatCents(total.expenseCents)} zł` : ""
                }`}
                accessibilityState={{
                  selected,
                  disabled: total.count === 0,
                }}
                disabled={total.count === 0}
                onPress={() => onSelectDay(selected ? null : day)}
                className="aspect-square items-center justify-center rounded-md"
                style={{
                  backgroundColor: spent
                    ? mixColor(colors.signal, colors.paper, 0.12 + share * 0.7)
                    : colors.wash,
                  borderWidth: selected ? 2 : 0,
                  borderColor: colors.deepInk,
                }}
              >
                <Text
                  className={
                    strong
                      ? "text-[12px] font-semibold text-on-signal"
                      : total.count
                        ? "text-[12px] font-semibold text-ink-soft"
                        : "text-[12px] text-ink-soft"
                  }
                >
                  {day}
                </Text>
                {spent && (
                  <Text
                    className={
                      strong
                        ? "font-utility text-[8px] text-on-signal"
                        : "font-utility text-[8px] text-ink-soft"
                    }
                  >
                    {Math.round(total.expenseCents / 100)}
                  </Text>
                )}
                {total.hasIncome && (
                  <View className="absolute top-1 right-1 size-1.5 rounded-full bg-income" />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
