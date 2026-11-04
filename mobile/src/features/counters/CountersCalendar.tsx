import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  counterMonths,
  type CounterMonth,
} from "@personal/shared/counterCalendar";
import { entryCountLabel } from "@personal/shared/counterFormat";
import {
  dayOfMonth,
  daysInMonth,
  leadingBlankDays,
  monthKeyOf,
  monthLabel,
  shiftMonth,
  WEEKDAY_LABELS,
  type MonthKey,
} from "@personal/shared/expenseMonth";
import type { CounterResponse } from "@personal/shared/generated/api";
import { useEveryCounterEntries } from "@personal/shared/queries/counters";
import type { CounterCalendarMode } from "@personal/shared/stores/counterView";

import { useTheme } from "@/theme";
import { MonthSwipe } from "@/ui/MonthSwipe";
import { NamedIcon } from "@/ui/NamedIcon";

const dayName = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
});

// Seven cells a row: a seventh of the width each, the gap inside the cell.
const CELL = "w-[14.2857%] p-0.5";

type MonthProps = {
  months: CounterMonth[];
  month: MonthKey;
  todayDay: number | null;
};

/**
 * One calendar for every Counter, above the Liczniki list, like the web: a
 * month grid with a dot per Counter on each day it got entries, or a row of
 * days per Counter.
 */
export function CountersCalendar({
  counters,
  mode,
}: {
  counters: CounterResponse[];
  mode: Exclude<CounterCalendarMode, "hidden">;
}) {
  const { colors } = useTheme();
  // Read the clock once, on mount: it picks the starting month and the day to ring.
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthKeyOf(today));
  const entries = useEveryCounterEntries(counters.map(({ id }) => id));
  const months = counterMonths(counters, (id) => entries.get(id), month);
  const todayDay = monthKeyOf(today) === month ? today.getDate() : null;

  return (
    // The day rows of the matrix scroll sideways, so only the grid swipes.
    <MonthSwipe
      enabled={mode === "grid"}
      onShift={(delta) => setMonth((shown) => shiftMonth(shown, delta))}
    >
      <View accessibilityLabel="Kalendarz liczników" className="pt-2 pb-4">
        <View className="mb-2 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Poprzedni miesiąc"
            hitSlop={8}
            onPress={() => setMonth((shown) => shiftMonth(shown, -1))}
            className="px-3 py-2 active:opacity-60"
          >
            <NamedIcon
              name="chevron-left"
              fallback="chevron-left"
              size={18}
              color={colors.inkSoft}
            />
          </Pressable>
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 text-center text-[15px] font-semibold text-ink"
          >
            {monthLabel(month)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Następny miesiąc"
            hitSlop={8}
            onPress={() => setMonth((shown) => shiftMonth(shown, 1))}
            className="px-3 py-2 active:opacity-60"
          >
            <NamedIcon
              name="chevron-right"
              fallback="chevron-right"
              size={18}
              color={colors.inkSoft}
            />
          </Pressable>
        </View>
        {mode === "grid" ? (
          <MonthGrid
            key={month}
            months={months}
            month={month}
            todayDay={todayDay}
          />
        ) : (
          <MonthMatrix months={months} month={month} todayDay={todayDay} />
        )}
      </View>
    </MonthSwipe>
  );
}

/** The month as one grid; the legend hides Counters, a day opens its sums. */
function MonthGrid({ months, month, todayDay }: MonthProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const shown = months.filter(({ counter }) => !hidden.has(counter.id));
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => i + 1);

  function toggle(id: number) {
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <View>
      <View className="mb-3 flex-row flex-wrap justify-center gap-2">
        {months.map(({ counter }) => {
          const isShown = !hidden.has(counter.id);
          return (
            <Pressable
              key={counter.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isShown }}
              onPress={() => toggle(counter.id)}
              className={
                isShown
                  ? "flex-row items-center gap-1.5 rounded-full border border-control-border px-2.5 py-1 active:opacity-60"
                  : "flex-row items-center gap-1.5 rounded-full border border-control-border px-2.5 py-1 opacity-40 active:opacity-60"
              }
            >
              <View
                className="size-2.5 rounded-full"
                // The Counter's own colour is data, not a theme token.
                style={{ backgroundColor: counter.color }}
              />
              <Text className="text-xs text-ink">{counter.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row flex-wrap">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} className={CELL}>
            <Text className="text-center font-utility text-[10px] font-semibold text-muted">
              {label.toUpperCase()}
            </Text>
          </View>
        ))}
        {Array.from({ length: leadingBlankDays(month) }, (_, index) => (
          <View key={`blank-${index}`} className={CELL} />
        ))}
        {days.map((day) => {
          const hits = shown.filter(({ days }) => days[day - 1] !== null);
          const names = hits.map(({ counter }) => counter.name).join(", ");
          const isSelected = selected === day;
          return (
            <View key={day} className={CELL}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${dayName.format(dayOfMonth(month, day))}: ${names || "brak wpisów"}`}
                accessibilityState={{
                  selected: isSelected,
                  disabled: hits.length === 0,
                }}
                disabled={hits.length === 0}
                onPress={() => setSelected(isSelected ? null : day)}
                className="aspect-square items-center justify-center gap-1 rounded-md bg-wash"
                style={
                  isSelected
                    ? { borderWidth: 2, borderColor: colors.deepInk }
                    : day === todayDay
                      ? { borderWidth: 2, borderColor: colors.signal }
                      : undefined
                }
              >
                <Text className="text-[13px] text-ink-soft">{day}</Text>
                <View className="min-h-1.5 flex-row flex-wrap justify-center gap-0.5 px-0.5">
                  {hits.map(({ counter }) => (
                    <View
                      key={counter.id}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: counter.color }}
                    />
                  ))}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
      {selected !== null && (
        <View className="mt-3 gap-1 rounded-lg border border-card-line bg-paper p-4">
          <Text className="mb-1 text-sm font-semibold text-ink">
            {dayName.format(dayOfMonth(month, selected))}
          </Text>
          {shown.map(({ counter, days: tallies }) => {
            const day = tallies[selected - 1];
            if (!day) return null;
            return (
              <View key={counter.id} className="flex-row items-center gap-2">
                <View
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: counter.color }}
                />
                <Text className="flex-1 text-sm text-ink">{counter.name}</Text>
                <Text className="text-xs text-muted">
                  {entryCountLabel(day.count)}
                </Text>
                <Text className="w-12 text-right font-utility text-sm font-semibold text-ink tabular-nums">
                  {day.sum}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** A row of days per Counter, scrolled sideways; a day's shade follows its sum. */
function MonthMatrix({ months, month, todayDay }: MonthProps) {
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => i + 1);
  return (
    <View className="flex-row">
      {/* The names stay put while the days scroll. */}
      <View className="pr-2">
        <View className="h-5" />
        {months.map(({ counter }) => (
          <View key={counter.id} className="h-7 justify-center">
            <Text className="max-w-28 text-sm text-ink" numberOfLines={1}>
              {counter.name}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View className="h-5 flex-row">
            {days.map((day) => (
              <Text
                key={day}
                className={
                  day === todayDay
                    ? "w-7 text-center text-[11px] font-bold text-signal"
                    : "w-7 text-center text-[11px] text-muted"
                }
              >
                {day}
              </Text>
            ))}
            <Text className="w-10 pl-1 text-[11px] text-muted">Dni</Text>
          </View>
          {months.map(({ counter, days: tallies, activeDays, largestSum }) => (
            <View key={counter.id} className="h-7 flex-row items-center">
              {tallies.map((tally, index) => (
                <View key={index} className="size-7 p-0.5">
                  <View
                    accessible
                    accessibilityLabel={`${counter.name}, ${dayName.format(dayOfMonth(month, index + 1))}: ${
                      tally
                        ? `${entryCountLabel(tally.count)}, suma ${tally.sum}`
                        : "brak wpisów"
                    }`}
                    className="flex-1 rounded-[4px] bg-wash"
                    // The Counter's own colour is data, not a theme token.
                    style={
                      tally
                        ? {
                            backgroundColor: counter.color,
                            opacity:
                              0.35 + (0.65 * Math.abs(tally.sum)) / largestSum,
                          }
                        : undefined
                    }
                  />
                </View>
              ))}
              <Text className="w-10 pl-1 text-xs text-muted">{activeDays}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
