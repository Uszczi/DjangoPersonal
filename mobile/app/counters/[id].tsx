import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  entryCountLabel,
  formatEntryTime,
  signedValue,
} from "@personal/shared/counterFormat";
import { COUNTER_ENTRIES_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCounterEntries,
  useCounters,
  useDeleteCounter,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";

import { Button } from "../../src/Button";
import { plusOneEntry } from "../../src/plusOne";
import { makeStyles, fonts, useTheme } from "../../src/theme";

/** One Counter: its total, quick +1, and the entries to add, edit and delete. */
export default function CounterScreen() {
  const { common } = useTheme();
  const styles = useStyles();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);

  const { data: counters = [] } = useCounters();
  const counter = counters.find((item) => item.id === id);
  const entriesQuery = useCounterEntries(id);
  const saveEntry = useSaveCounterEntry();
  const deleteCounter = useDeleteCounter();
  const [actionError, setActionError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);
    await entriesQuery.refetch();
    setIsRefreshing(false);
  }

  async function addOne() {
    setActionError("");
    try {
      await saveEntry.mutateAsync({ counterId: id, input: plusOneEntry() });
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
              await deleteCounter.mutateAsync(id);
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

  const entries = entriesQuery.data ?? null;
  const entriesError = entriesQuery.isError ? COUNTER_ENTRIES_LOAD_ERROR : "";
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

const useStyles = makeStyles((colors) => ({
  listContent: { paddingBottom: 32 },
  header: { padding: 16, gap: 4 },
  total: {
    fontFamily: fonts.utility,
    fontSize: 44,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  error: { color: colors.danger, marginTop: 8 },
  sectionTitle: {
    marginTop: 20,
    color: colors.muted,
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
  },
  empty: { padding: 24, textAlign: "center" },
  entryTime: { fontSize: 14, fontWeight: "500", color: colors.ink },
  entryValue: {
    fontFamily: fonts.utility,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  negative: { color: colors.danger },
}));
