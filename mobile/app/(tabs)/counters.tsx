import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  counterRecencyLabel,
  entryCountLabel,
} from "@personal/shared/counterFormat";
import type { CounterResponse } from "@personal/shared/generated/api";
import { COUNTERS_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCounters,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";

import { ChipGroup } from "../../src/ChipGroup";
import {
  type CounterViewMode,
  useCounterViewStore,
} from "../../src/counterView";
import { Fab } from "../../src/Fab";
import { plusOneEntry } from "../../src/plusOne";
import { makeStyles, fonts, useTheme } from "../../src/theme";

const VIEW_MODES: { value: CounterViewMode; label: string }[] = [
  { value: "rows", label: "Wiersze" },
  { value: "tiles", label: "Kafelki" },
];

function openCounter(counter: CounterResponse) {
  router.push({ pathname: "/counters/[id]", params: { id: counter.id } });
}

export default function CountersScreen() {
  const { common } = useTheme();
  const styles = useStyles();
  const { data: counters = [], isPending, isError, refetch } = useCounters();
  const saveEntry = useSaveCounterEntry();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
  const viewMode = useCounterViewStore((state) => state.mode);
  const setViewMode = useCounterViewStore((state) => state.setMode);
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
    <View style={common.screen}>
      {(pageError || actionError) !== "" && (
        <Text style={common.error}>{pageError || actionError}</Text>
      )}
      <View style={styles.toolbar}>
        <ChipGroup
          options={VIEW_MODES}
          value={viewMode}
          onChange={setViewMode}
        />
      </View>
      <FlatList
        // FlatList cannot change numColumns in place; remount on switch.
        key={viewMode}
        data={counters}
        numColumns={isTiles ? 2 : 1}
        columnWrapperStyle={isTiles ? styles.tileRow : undefined}
        keyExtractor={(counter) => String(counter.id)}
        contentContainerStyle={[
          styles.listContent,
          isTiles && styles.tileListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isPending}
            onRefresh={() => void refresh()}
          />
        }
        ListEmptyComponent={
          !isPending && pageError === "" ? (
            <Text style={[common.muted, styles.empty]}>
              Brak liczników. Utwórz pierwszy przyciskiem +.
            </Text>
          ) : undefined
        }
        renderItem={({ item }) =>
          isTiles ? (
            <View style={styles.tile}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Otwórz licznik: ${item.name}`}
                onPress={() => openCounter(item)}
                style={({ pressed }) => [
                  styles.tileBody,
                  pressed && styles.tilePressed,
                ]}
              >
                <Text style={[styles.name, styles.tileText]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text
                  style={[styles.tileTotal, styles.tileText]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityLabel={`Suma: ${item.total}`}
                >
                  {item.total}
                </Text>
                <Text style={common.muted}>
                  {entryCountLabel(item.entryCount)}
                </Text>
                <RecencyLine counter={item} />
              </Pressable>
              <View style={styles.tileFooter}>
                <PlusOneButton counter={item} onPress={addOne} />
              </View>
            </View>
          ) : (
            <Pressable
              style={common.row}
              accessibilityRole="button"
              accessibilityLabel={`Otwórz licznik: ${item.name}`}
              onPress={() => openCounter(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={common.rowSubtitle}>
                  {entryCountLabel(item.entryCount)}
                </Text>
              </View>
              <Text
                style={styles.total}
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

/** The tile's streak, or the days since its last entry; nothing before the first. */
function RecencyLine({ counter }: { counter: CounterResponse }) {
  const { common } = useTheme();
  const styles = useStyles();
  const label = counterRecencyLabel(counter);
  if (label === null) return null;
  return (
    <Text style={[common.muted, counter.streakDays > 0 && styles.streak]}>
      {label}
    </Text>
  );
}

function PlusOneButton({
  counter,
  onPress,
}: {
  counter: CounterResponse;
  onPress: (counter: CounterResponse) => Promise<void>;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dodaj 1 do licznika: ${counter.name}`}
      hitSlop={8}
      onPress={() => void onPress(counter)}
      style={({ pressed }) => [styles.plusOne, pressed && styles.pressed]}
    >
      <Text style={styles.plusOneLabel}>+1</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  toolbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  listContent: { paddingBottom: 96 },
  tileListContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  tileRow: { gap: 12 },
  // The web CounterTile: name, big total, entry count, +1 in a footer.
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.rowLine,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  tileBody: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 4,
  },
  tilePressed: { backgroundColor: colors.wash },
  // Full width, so long names truncate and the total shrinks to fit, centred.
  tileText: { alignSelf: "stretch", textAlign: "center" },
  streak: { color: colors.ink, fontWeight: "500" },
  tileTotal: {
    fontFamily: fonts.utility,
    fontSize: 30,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  tileFooter: {
    flexDirection: "row",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: colors.rowLine,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  empty: { padding: 24, textAlign: "center" },
  name: { fontSize: 14, fontWeight: "500", color: colors.ink },
  total: {
    marginRight: 4,
    fontFamily: fonts.utility,
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  plusOne: {
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.6 },
  plusOneLabel: { color: colors.inkSoft, fontWeight: "600", fontSize: 13 },
}));
