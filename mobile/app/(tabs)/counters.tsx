import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  COUNTER_TILE_VALUE_LABELS,
  COUNTER_VIEW_MODE_LABELS,
  counterTileContent,
  entryCountLabel,
} from "@personal/shared/counterFormat";
import type { CounterResponse } from "@personal/shared/generated/api";
import type { CounterTileContent } from "@personal/shared/counterFormat";
import { COUNTERS_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCounters,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";
import {
  COUNTER_TILE_VALUES,
  COUNTER_VIEW_MODES,
  useCounterViewStore,
} from "@personal/shared/stores/counterView";

import { ChipGroup } from "../../src/ui/ChipGroup";
import { ColorDot } from "../../src/ui/ColorDot";
import { Fab } from "../../src/ui/Fab";
import { plusOneEntry } from "../../src/features/counters/plusOne";

const VIEW_MODES = COUNTER_VIEW_MODES.map((value) => ({
  value,
  label: COUNTER_VIEW_MODE_LABELS[value],
}));

const TILE_VALUES = COUNTER_TILE_VALUES.map((value) => ({
  value,
  label: COUNTER_TILE_VALUE_LABELS[value],
}));

function openCounter(counter: CounterResponse) {
  router.push({ pathname: "/counters/[id]", params: { id: counter.id } });
}

/**
 * Liczniki, styled with Uniwind classes (the prototype screen): colours are
 * the shared palette tokens, so they follow the theme like `makeStyles` does.
 */
export default function CountersScreen() {
  const { data: counters = [], isPending, isError, refetch } = useCounters();
  const saveEntry = useSaveCounterEntry();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
  const viewMode = useCounterViewStore((state) => state.mode);
  const setViewMode = useCounterViewStore((state) => state.setMode);
  const tileValue = useCounterViewStore((state) => state.tileValue);
  const setTileValue = useCounterViewStore((state) => state.setTileValue);
  const isTiles = viewMode === "tiles";
  const pageError = isError ? COUNTERS_LOAD_ERROR : "";

  async function refresh() {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }

  async function addOne(counter: CounterResponse) {
    setActionError("");
    try {
      await saveEntry.mutateAsync({
        counterId: counter.id,
        input: plusOneEntry(),
      });
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      {(pageError || actionError) !== "" && (
        <Text className="p-4 text-[13px] text-danger">
          {pageError || actionError}
        </Text>
      )}
      <View className="px-4 pt-3 pb-1">
        <ChipGroup
          options={VIEW_MODES}
          value={viewMode}
          onChange={setViewMode}
        />
        {isTiles && (
          <View className="mt-2.5 gap-1.5">
            <Text className="text-xs text-muted">Na środku kafelka</Text>
            <ChipGroup
              options={TILE_VALUES}
              value={tileValue}
              onChange={setTileValue}
            />
          </View>
        )}
      </View>
      <FlatList
        // FlatList cannot change numColumns in place; remount on switch.
        key={viewMode}
        data={counters}
        numColumns={isTiles ? 2 : 1}
        columnWrapperClassName={isTiles ? "gap-3" : undefined}
        keyExtractor={(counter) => String(counter.id)}
        contentContainerClassName={isTiles ? "px-4 pt-2 pb-24 gap-3" : "pb-24"}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isPending}
            onRefresh={() => void refresh()}
          />
        }
        ListEmptyComponent={
          !isPending && pageError === "" ? (
            <Text className="p-6 text-center text-xs text-muted">
              Brak liczników. Utwórz pierwszy przyciskiem +.
            </Text>
          ) : undefined
        }
        renderItem={({ item }) =>
          isTiles ? (
            <CounterTile
              counter={item}
              content={counterTileContent(item, tileValue)}
              onAddOne={addOne}
            />
          ) : (
            <Pressable
              className="mx-4 min-h-[62px] flex-row items-center gap-[13px] border-b border-row-line px-[3px] py-2.5"
              accessibilityRole="button"
              accessibilityLabel={`Otwórz licznik: ${item.name}`}
              onPress={() => openCounter(item)}
            >
              <ColorDot color={item.color} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-ink">
                  {item.name}
                </Text>
                <Text className="mt-0.5 text-xs text-muted">
                  {entryCountLabel(item.entryCount)}
                </Text>
              </View>
              <Text
                className="mr-1 font-utility text-[18px] font-semibold text-ink tabular-nums"
                accessibilityLabel={`Suma: ${item.total}`}
              >
                {item.total}
              </Text>
              <PlusOneButton counter={item} onPress={addOne} />
            </Pressable>
          )
        }
      />
      <Fab
        accessibilityLabel="Nowy licznik"
        onPress={() => router.push("/counter")}
      />
    </View>
  );
}

/** Name, the chosen value large, what it counts, the streak; +1 in a footer. */
function CounterTile({
  counter,
  content,
  onAddOne,
}: {
  counter: CounterResponse;
  content: CounterTileContent;
  onAddOne: (counter: CounterResponse) => Promise<void>;
}) {
  return (
    <View
      className="flex-1 overflow-hidden rounded-lg border border-t-4 border-row-line bg-surface"
      // The Counter's own colour is data, not a theme token.
      style={{ borderTopColor: counter.color }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Otwórz licznik: ${counter.name}`}
        onPress={() => openCounter(counter)}
        className="items-center gap-1 px-3.5 pt-3.5 pb-2.5 active:bg-wash"
      >
        {/* Full width, so long names truncate and the total shrinks to fit, centred. */}
        <Text
          className="self-stretch text-center text-sm font-medium text-ink"
          numberOfLines={1}
        >
          {counter.name}
        </Text>
        <Text
          className="self-stretch text-center font-utility text-[30px] font-semibold text-ink tabular-nums"
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={content.valueLabel}
        >
          {content.value}
        </Text>
        {content.unit !== null && (
          <Text className="text-xs text-muted">{content.unit}</Text>
        )}
        <Text className="text-xs text-muted">{content.caption}</Text>
        {content.recency !== null && (
          <Text
            className={
              counter.streakDays > 0
                ? "text-xs font-medium text-ink"
                : "text-xs text-muted"
            }
          >
            {content.recency}
          </Text>
        )}
      </Pressable>
      <View className="flex-row justify-center border-t border-row-line px-2.5 py-2">
        <PlusOneButton counter={counter} onPress={onAddOne} />
      </View>
    </View>
  );
}

function PlusOneButton({
  counter,
  onPress,
}: {
  counter: CounterResponse;
  onPress: (counter: CounterResponse) => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dodaj 1 do licznika: ${counter.name}`}
      hitSlop={8}
      onPress={() => void onPress(counter)}
      className="rounded-[5px] border border-control-border px-3.5 py-2 active:opacity-60"
    >
      <Text className="text-[13px] font-semibold text-ink-soft">+1</Text>
    </Pressable>
  );
}
