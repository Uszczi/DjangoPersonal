import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { entryCountLabel } from "@personal/shared/counterFormat";
import type { CounterResponse } from "@personal/shared/generated/api";
import { useCountersStore } from "@personal/shared/stores/counters";

import { Fab } from "../../src/Fab";
import { plusOneEntry } from "../../src/plusOne";
import { colors, common } from "../../src/theme";

export default function CountersScreen() {
  const counters = useCountersStore((state) => state.counters);
  const isLoading = useCountersStore((state) => state.isLoading);
  const pageError = useCountersStore((state) => state.pageError);
  const loadCounters = useCountersStore((state) => state.loadCounters);
  const saveEntry = useCountersStore((state) => state.saveEntry);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    void loadCounters();
  }, [loadCounters]);

  async function refresh() {
    setIsRefreshing(true);
    await loadCounters();
    setIsRefreshing(false);
  }

  async function addOne(counter: CounterResponse) {
    setActionError("");
    try {
      await saveEntry(counter.id, plusOneEntry());
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
            refreshing={isRefreshing || (isLoading && counters.length === 0)}
            onRefresh={() => void refresh()}
          />
        }
        ListEmptyComponent={
          !isLoading && pageError === "" ? (
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
              <Text style={common.muted}>
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

const styles = StyleSheet.create({
  listContent: { paddingBottom: 96 },
  empty: { padding: 24, textAlign: "center" },
  name: { fontSize: 16, color: colors.text },
  total: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  plusOne: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.6 },
  plusOneLabel: { color: colors.primary, fontWeight: "700", fontSize: 16 },
});
