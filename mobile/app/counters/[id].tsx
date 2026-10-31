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

import { Button } from "../../src/ui/Button";
import { ColorDot } from "../../src/ui/ColorDot";
import { NamedIcon } from "../../src/ui/NamedIcon";
import { plusOneEntry } from "../../src/features/counters/plusOne";
import { common } from "../../src/ui/classes";

/** One Counter: its total, quick +1, and the entries to add, edit and delete. */
export default function CounterScreen() {
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

  /** The editor changes the name and the colour. */
  function openEditor() {
    router.push({ pathname: "/counter", params: { counterId: id } });
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
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono licznika.</Text>
      </View>
    );
  }

  const entries = entriesQuery.data ?? null;
  const entriesError = entriesQuery.isError ? COUNTER_ENTRIES_LOAD_ERROR : "";
  const errorMessage = actionError || entriesError;

  return (
    <View className={common.screen}>
      <Stack.Screen options={{ title: counter.name }} />
      <FlatList
        data={entries ?? []}
        keyExtractor={(entry) => String(entry.id)}
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={
              isRefreshing || (entries === null && entriesError === "")
            }
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View className="gap-1 p-4">
            <View className="flex-row items-center justify-between">
              <Text
                className="font-utility text-[44px] font-bold text-ink tabular-nums"
                accessibilityLabel={`Suma: ${counter.total}`}
              >
                {counter.total}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Zmień kolor licznika: ${counter.name}`}
                hitSlop={8}
                onPress={openEditor}
                className="rounded-lg p-1.5 active:opacity-60"
              >
                <NamedIcon
                  name="palette"
                  fallback="palette"
                  color={counter.color}
                  size={26}
                />
              </Pressable>
            </View>
            <View className="flex-row items-center gap-2">
              <ColorDot color={counter.color} />
              <Text className={common.muted}>
                {entryCountLabel(counter.entryCount)}
              </Text>
            </View>
            <View className="mt-3 flex-row gap-3">
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
            <View className="mt-3 flex-row gap-3">
              <Button label="Edytuj" variant="secondary" onPress={openEditor} />
              <Button
                label="Usuń licznik"
                variant="danger"
                onPress={confirmDelete}
              />
            </View>
            {errorMessage !== "" && (
              <Text className="mt-2 text-danger">{errorMessage}</Text>
            )}
            {entries !== null && entries.length > 0 && (
              <Text className="mt-5 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
                Wpisy
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          entries !== null ? (
            <Text className="p-6 text-center text-xs text-muted">
              Brak wpisów. Dodaj pierwszy wpis.
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            className={common.row}
            accessibilityRole="button"
            accessibilityLabel={`Edytuj wpis ${signedValue(item.value)} z ${formatEntryTime(item.occurredAt)}`}
            onPress={() =>
              router.push({
                pathname: "/counter-entry",
                params: { counterId: id, entryId: item.id },
              })
            }
          >
            <View className="flex-1">
              <Text className="text-sm font-medium text-ink">
                {formatEntryTime(item.occurredAt)}
              </Text>
              {item.note !== "" && (
                <Text className={common.muted}>{item.note}</Text>
              )}
            </View>
            <Text
              className={
                item.value < 0
                  ? "font-utility text-sm font-semibold text-danger"
                  : "font-utility text-sm font-semibold text-ink"
              }
            >
              {signedValue(item.value)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
