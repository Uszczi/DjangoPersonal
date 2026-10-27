import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  entryCountLabel,
  formatEntryTime,
  signedValue,
} from "@personal/shared/counterFormat";
import { useCountersStore } from "@personal/shared/stores/counters";

import { Button } from "../../src/Button";
import { plusOneEntry } from "../../src/plusOne";
import { colors, common } from "../../src/theme";

/** One Counter: its total, quick +1, and the entries to add, edit and delete. */
export default function CounterScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);

  const counter = useCountersStore((state) =>
    state.counters.find((item) => item.id === id),
  );
  const entryList = useCountersStore((state) => state.entryList);
  const entriesError = useCountersStore((state) => state.entriesError);
  const loadEntries = useCountersStore((state) => state.loadEntries);
  const saveEntry = useCountersStore((state) => state.saveEntry);
  const deleteCounter = useCountersStore((state) => state.deleteCounter);
  const [actionError, setActionError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void loadEntries(id);
  }, [id, loadEntries]);

  async function refresh() {
    setIsRefreshing(true);
    await loadEntries(id);
    setIsRefreshing(false);
  }

  async function addOne() {
    setActionError("");
    try {
      await saveEntry(id, plusOneEntry());
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
  }

  function confirmDelete() {
    if (!counter) return;
    Alert.alert(
      "Usunąć licznik?",
      `„${counter.name}” zostanie usunięty razem ze wszystkimi wpisami.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń licznik",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCounter(id);
              router.back();
            } catch (error) {
              setActionError(await apiErrorMessage(error));
            }
          },
        },
      ],
    );
  }

  if (!counter) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono licznika.</Text>
      </View>
    );
  }

  const entries = entryList?.counterId === id ? entryList.entries : null;
  const errorMessage = actionError || entriesError;

  return (
    <View style={common.screen}>
      <Stack.Screen options={{ title: counter.name }} />
      <FlatList
        data={entries ?? []}
        keyExtractor={(entry) => String(entry.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={
              isRefreshing || (entries === null && entriesError === "")
            }
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text
              style={styles.total}
              accessibilityLabel={`Suma: ${counter.total}`}
            >
              {counter.total}
            </Text>
            <Text style={common.muted}>
              {entryCountLabel(counter.entryCount)}
            </Text>
            <View style={styles.actions}>
              <Button label="+1" onPress={() => void addOne()} />
              <Button
                label="Nowy wpis"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/counter-entry",
                    params: { counterId: id },
                  })
                }
              />
            </View>
            <View style={styles.actions}>
              <Button
                label="Zmień nazwę"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/counter",
                    params: { counterId: id },
                  })
                }
              />
              <Button
                label="Usuń licznik"
                variant="danger"
                onPress={confirmDelete}
              />
            </View>
            {errorMessage !== "" && (
              <Text style={styles.error}>{errorMessage}</Text>
            )}
            {entries !== null && entries.length > 0 && (
              <Text style={styles.sectionTitle}>Wpisy</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          entries !== null ? (
            <Text style={[common.muted, styles.empty]}>
              Brak wpisów. Dodaj pierwszy wpis.
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            style={common.row}
            accessibilityRole="button"
            accessibilityLabel={`Edytuj wpis ${signedValue(item.value)} z ${formatEntryTime(item.occurredAt)}`}
            onPress={() =>
              router.push({
                pathname: "/counter-entry",
                params: { counterId: id, entryId: item.id },
              })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.entryTime}>
                {formatEntryTime(item.occurredAt)}
              </Text>
              {item.note !== "" && (
                <Text style={common.muted}>{item.note}</Text>
              )}
            </View>
            <Text
              style={[styles.entryValue, item.value < 0 && styles.negative]}
            >
              {signedValue(item.value)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: 32 },
  header: { padding: 16, gap: 4 },
  total: {
    fontSize: 56,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  error: { color: colors.danger, marginTop: 8 },
  sectionTitle: {
    marginTop: 20,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  empty: { padding: 24, textAlign: "center" },
  entryTime: { fontSize: 15, color: colors.text },
  entryValue: { fontSize: 16, fontWeight: "600", color: colors.text },
  negative: { color: colors.danger },
});
