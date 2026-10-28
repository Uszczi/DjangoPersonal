import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { entryCountLabel } from "@personal/shared/counterFormat";
import type { CounterResponse } from "@personal/shared/generated/api";
import { COUNTERS_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCounters,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";

import { Fab } from "../../src/Fab";
import { plusOneEntry } from "../../src/plusOne";
import { makeStyles, fonts, useTheme } from "../../src/theme";

export default function CountersScreen() {
  const { common } = useTheme();
  const styles = useStyles();
  const { data: counters = [], isPending, isError, refetch } = useCounters();
  const saveEntry = useSaveCounterEntry();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
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
      <FlatList
        data={counters}
        keyExtractor={(counter) => String(counter.id)}
        contentContainerStyle={styles.listContent}
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
        renderItem={({ item }) => (
          <Pressable
            style={common.row}
            accessibilityRole="button"
            accessibilityLabel={`Otwórz licznik: ${item.name}`}
            onPress={() =>
              router.push({
                pathname: "/counters/[id]",
                params: { id: item.id },
              })
            }
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Dodaj 1 do licznika: ${item.name}`}
              hitSlop={8}
              onPress={() => void addOne(item)}
              style={({ pressed }) => [
                styles.plusOne,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.plusOneLabel}>+1</Text>
            </Pressable>
          </Pressable>
        )}
      />
      <Fab
        accessibilityLabel="Nowy licznik"
        onPress={() => router.push("/counter")}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  listContent: { paddingBottom: 96 },
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
