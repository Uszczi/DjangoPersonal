import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { formatDuration } from "@personal/shared/timeFormat";
import {
  computeTimeStats,
  dayStreaks,
  hourTicks,
  seriesColor,
  STATS_PERIOD_LABELS,
  STATS_PERIODS,
  type StatsBucket,
  type StatsPeriod,
  type TimeStats as Stats,
} from "@personal/shared/timeStats";

import { card, common } from "@/ui/classes";
import { ChipGroup } from "@/ui/ChipGroup";
import { useTheme } from "@/theme";

const COMPARED_WITH: Record<StatsPeriod, string> = {
  week: "poprzedni tydzień",
  month: "poprzedni miesiąc",
  year: "poprzedni rok",
};

const CHART_HEIGHT = 180;

type TimeStatsProps = {
  /** The stopped entries. */
  entries: TimeEntryResponse[];
  tasks: TaskResponse[];
  projects: ProjectResponse[];
  nowTick: number;
};

/** Statystyki: one week, month or year of the stopped entries, split by Project. */
export function TimeStats({
  entries,
  tasks,
  projects,
  nowTick,
}: TimeStatsProps) {
  const { colors, scheme } = useTheme();
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const colorOf = (slot: number) => seriesColor(slot, scheme);

  const stats = computeTimeStats({
    entries,
    tasks,
    projects,
    period,
    offset,
    now: nowTick,
  });
  const streaks = dayStreaks(entries, nowTick);
  const shown = active == null ? null : stats.buckets[active];

  function changePeriod(next: StatsPeriod, nextOffset: number) {
    setPeriod(next);
    setOffset(nextOffset);
    setActive(null);
  }

  return (
    <View>
      <View className="mx-4 mt-4 gap-3">
        <ChipGroup
          options={STATS_PERIODS.map((value) => ({
            value,
            label: STATS_PERIOD_LABELS[value],
          }))}
          value={period}
          onChange={(next) => changePeriod(next, 0)}
        />
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Poprzedni okres"
            onPress={() => changePeriod(period, offset + 1)}
            className="size-10 items-center justify-center rounded-[5px] border border-control-border active:opacity-60"
          >
            <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Następny okres"
            accessibilityState={{ disabled: offset === 0 }}
            disabled={offset === 0}
            onPress={() => changePeriod(period, offset - 1)}
            className={
              offset === 0
                ? "size-10 items-center justify-center rounded-[5px] border border-control-border opacity-40"
                : "size-10 items-center justify-center rounded-[5px] border border-control-border active:opacity-60"
            }
          >
            <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
          </Pressable>
          <Text className="ml-1 font-display text-[18px] font-bold text-ink">
            {stats.label}
          </Text>
        </View>
      </View>

      <View className="mx-4 mt-4 flex-row flex-wrap gap-3">
        <Tile
          label="ŁĄCZNIE"
          value={formatDuration(stats.total)}
          note={changeNote(stats, period)}
          tone={
            stats.change == null ? undefined : stats.change >= 0 ? "up" : "down"
          }
        />
        <Tile
          label="ŚREDNIO NA AKTYWNY DZIEŃ"
          value={formatDuration(
            stats.activeDays ? Math.round(stats.total / stats.activeDays) : 0,
          )}
          note={`${stats.entryCount} ${stats.entryCount === 1 ? "wpis" : "wpisów"}`}
        />
        <Tile
          label="AKTYWNE DNI"
          value={String(stats.activeDays)}
          note={`z ${stats.periodDays} dni`}
        />
        <Tile
          label="SERIA DNI Z RZĘDU"
          value={String(streaks.current)}
          note={`rekord: ${streaks.best}`}
        />
      </View>

      <View className={card.section}>
        <Text className="font-display text-[16px] font-bold text-ink">
          {period === "year" ? "Czas w miesiącach" : "Czas w dniach"}
        </Text>
        <View className="flex-row flex-wrap gap-x-3 gap-y-1">
          {stats.series.map((row) => (
            <View key={row.key} className="flex-row items-center gap-1.5">
              <View
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: colorOf(row.slot) }}
              />
              <Text className="text-xs text-ink-soft">{row.name}</Text>
            </View>
          ))}
        </View>
        {stats.total === 0 ? (
          <Text className="py-8 text-center text-xs text-muted">
            Brak wpisów w tym okresie.
          </Text>
        ) : (
          <>
            <Columns
              buckets={stats.buckets}
              period={period}
              active={active}
              onPick={(index) => setActive(active === index ? null : index)}
              colorOf={colorOf}
            />
            <View className="min-h-[52px] rounded border border-line-soft bg-wash px-3 py-2">
              {shown ? (
                <>
                  <Text className="text-xs font-semibold text-ink">
                    {shown.longLabel} · {formatDuration(shown.minutes)}
                  </Text>
                  {shown.series.map((row) => (
                    <View
                      key={row.key}
                      className="flex-row items-center gap-1.5"
                    >
                      <View
                        className="size-2 rounded-sm"
                        style={{ backgroundColor: colorOf(row.slot) }}
                      />
                      <Text className="text-xs text-ink-soft">
                        {row.name}: {formatDuration(row.minutes)}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text className={common.muted}>
                  Dotknij słupka, aby zobaczyć szczegóły.
                </Text>
              )}
            </View>
          </>
        )}
      </View>

      <View className={card.section}>
        <Text className="font-display text-[16px] font-bold text-ink">
          Według projektu
        </Text>
        <BarList
          rows={[...stats.series]
            .sort((a, b) => b.minutes - a.minutes)
            .map((row) => ({
              key: row.key,
              label: row.name,
              minutes: row.minutes,
              color: colorOf(row.slot),
            }))}
          total={stats.total}
        />
      </View>
      <View className={card.section}>
        <Text className="font-display text-[16px] font-bold text-ink">
          Najwięcej czasu na
        </Text>
        <BarList
          rows={stats.topTitles.map((row) => ({
            key: row.title,
            label: row.title,
            minutes: row.minutes,
            color: colors.accent,
          }))}
          total={stats.total}
        />
      </View>
    </View>
  );
}

function changeNote(stats: Stats, period: StatsPeriod) {
  if (stats.change == null) return "brak danych do porównania";
  const arrow = stats.change >= 0 ? "▲" : "▼";
  const stretch = stats.partial ? " (ten sam odcinek)" : "";
  return `${arrow} ${Math.abs(stats.change)}% vs ${COMPARED_WITH[period]}${stretch}`;
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "up" | "down";
}) {
  return (
    <View className="min-w-[45%] flex-1 rounded-lg border border-card-line bg-paper p-4">
      <Text className={card.kicker}>{label}</Text>
      <Text className="mt-1 font-display text-[20px] font-bold text-ink">
        {value}
      </Text>
      <Text
        className={
          tone === "up"
            ? "text-xs text-income"
            : tone === "down"
              ? "text-xs text-expense"
              : "text-xs text-muted"
        }
      >
        {note}
      </Text>
    </View>
  );
}

/** One column per day (or month), its Projects stacked; a tap selects it. */
function Columns({
  buckets,
  period,
  active,
  onPick,
  colorOf,
}: {
  buckets: StatsBucket[];
  period: StatsPeriod;
  active: number | null;
  onPick: (index: number) => void;
  colorOf: (slot: number) => string;
}) {
  const { maxMinutes, ticks } = hourTicks(
    Math.max(...buckets.map((bucket) => bucket.minutes)),
  );
  const y = (minutes: number) => (minutes / maxMinutes) * CHART_HEIGHT;
  const labelled = (index: number) =>
    period !== "month" || index % 5 === 0 || index === buckets.length - 1;

  return (
    <View className="mt-2 flex-row">
      <View className="mr-1.5 w-7" style={{ height: CHART_HEIGHT }}>
        {ticks.map((tick) => (
          <Text
            key={tick}
            className="absolute right-0 font-utility text-[10px] text-muted"
            style={{ top: CHART_HEIGHT - y(tick * 60) - 7 }}
          >
            {tick} h
          </Text>
        ))}
      </View>
      <View className="flex-1">
        <View style={{ height: CHART_HEIGHT }}>
          {ticks.map((tick) => (
            <View
              key={tick}
              className={
                tick === 0
                  ? "absolute inset-x-0 border-t border-control-border"
                  : "absolute inset-x-0 border-t border-line-soft"
              }
              style={{ top: CHART_HEIGHT - y(tick * 60) }}
            />
          ))}
          <View className="flex-1 flex-row items-end gap-[2px]">
            {buckets.map((bucket, index) => (
              <Pressable
                key={bucket.key}
                accessibilityRole="button"
                accessibilityLabel={`${bucket.longLabel}: ${formatDuration(bucket.minutes)}`}
                onPress={() => onPick(index)}
                className={
                  active != null && active !== index
                    ? "h-full flex-1 justify-end opacity-50"
                    : "h-full flex-1 justify-end"
                }
              >
                <View className="w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t">
                  {bucket.series.map((row) => (
                    <View
                      key={row.key}
                      style={{
                        height: Math.max(1, y(row.minutes) - 2),
                        backgroundColor: colorOf(row.slot),
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
        <View className="mt-1 flex-row gap-[2px]">
          {buckets.map((bucket, index) => (
            <Text
              key={bucket.key}
              numberOfLines={1}
              className="flex-1 text-center font-utility text-[10px] text-muted"
            >
              {labelled(index) ? bucket.label : ""}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function BarList({
  rows,
  total,
}: {
  rows: { key: string; label: string; minutes: number; color: string }[];
  total: number;
}) {
  if (rows.length === 0)
    return <Text className={common.muted}>Brak wpisów w tym okresie.</Text>;
  const top = Math.max(1, ...rows.map((row) => row.minutes));
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row.key} className="gap-1">
          <View className="flex-row items-baseline justify-between gap-3">
            <Text className="flex-1 text-[13px] text-ink" numberOfLines={1}>
              {row.label}
            </Text>
            <Text className="font-utility text-[11px] text-ink-soft">
              {formatDuration(row.minutes)} ·{" "}
              {Math.round((row.minutes / Math.max(1, total)) * 100)}%
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-line-soft">
            <View
              className="h-full rounded-full"
              style={{
                width: `${(row.minutes / top) * 100}%`,
                backgroundColor: row.color,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
