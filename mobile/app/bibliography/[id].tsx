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

import {
  attemptDates,
  attemptProgress,
  ITEM_KIND_LABELS,
  itemByline,
  itemStatusLabel,
} from "@personal/shared/bibliographyFormat";
import type { AttemptAction } from "@personal/shared/bibliographyForms";
import { apiErrorMessage, isNotFound } from "@personal/shared/apiErrorMessage";
import type { AttemptResponse } from "@personal/shared/generated/api";
import {
  ATTEMPTS_LOAD_ERROR,
  BIBLIOGRAPHY_ITEMS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useAttempts } from "@personal/shared/queries/bibliographyAttempts";
import {
  useBibliographyItem,
  useDeleteBibliographyItem,
} from "@personal/shared/queries/bibliographyItems";

import { Button } from "../../src/ui/Button";
import { common } from "../../src/ui/classes";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

/** One film or book: its derived status, the actions its Attempts allow, and their history. */
export default function BibliographyItemScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);

  const itemQuery = useBibliographyItem(Number.isInteger(id) ? id : null);
  const item = itemQuery.data;
  const attemptsQuery = useAttempts(item ? id : null);
  const deleteItem = useDeleteBibliographyItem();
  const [deleteError, setDeleteError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  useRefreshOnFocus(attemptsQuery.refetch);

  async function refresh() {
    setIsRefreshing(true);
    await Promise.all([itemQuery.refetch(), attemptsQuery.refetch()]);
    setIsRefreshing(false);
  }

  if (!item) {
    const isMissing =
      !Number.isInteger(id) ||
      (itemQuery.isError && isNotFound(itemQuery.error));
    return (
      <View className={common.center}>
        <Text className={common.muted}>
          {isMissing
            ? "Nie znaleziono pozycji."
            : itemQuery.isError
              ? BIBLIOGRAPHY_ITEMS_LOAD_ERROR
              : "Wczytywanie pozycji…"}
        </Text>
      </View>
    );
  }

  const attempts = attemptsQuery.data ?? null;
  const open = attempts?.find((attempt) => attempt.outcome === "in_progress");
  const byline = itemByline(item);
  const progress = open
    ? attemptProgress({
        progress: open.progress,
        length: item.length,
        kind: item.kind,
      })
    : "";
  const attemptsError = attemptsQuery.isError ? ATTEMPTS_LOAD_ERROR : "";
  const errorMessage = deleteError || attemptsError;

  function confirmDelete() {
    if (!item) return;
    Alert.alert(
      "Usunąć pozycję?",
      `„${item.title}” zostanie usunięta razem ze wszystkimi podejściami.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń pozycję",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItem.mutateAsync(id);
              router.back();
            } catch (error) {
              setDeleteError(await apiErrorMessage(error));
            }
          },
        },
      ],
    );
  }

  function showAttempt(action: AttemptAction, attempt?: AttemptResponse) {
    router.push({
      pathname: "/attempt",
      params: {
        itemId: id,
        action,
        ...(attempt ? { attemptId: attempt.id } : {}),
      },
    });
  }

  return (
    <View className={common.screen}>
      <Stack.Screen options={{ title: ITEM_KIND_LABELS[item.kind] }} />
      <FlatList
        data={attempts ?? []}
        keyExtractor={(attempt) => String(attempt.id)}
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={
              isRefreshing || (attempts === null && attemptsError === "")
            }
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View className="gap-1.5 p-4">
            <Text className={common.pageTitle}>{item.title}</Text>
            {byline !== "" && <Text className={common.muted}>{byline}</Text>}
            <View className="mt-1 flex-row items-center gap-2.5">
              <Text className={common.eyebrow}>
                {ITEM_KIND_LABELS[item.kind].toUpperCase()}
              </Text>
              {/* The web's status pill. */}
              <Text
                className="rounded-full border border-row-line px-3 py-1 text-[13px] text-ink-soft"
                accessibilityLabel="Status"
              >
                {itemStatusLabel(item.status, item.kind)}
              </Text>
            </View>
            {item.note !== "" && (
              <Text className="mt-1 text-sm text-ink-soft">{item.note}</Text>
            )}
            {progress !== "" && (
              <Text
                className="mt-1.5 font-utility text-[15px] text-ink-soft"
                accessibilityLabel="Postęp"
              >
                {progress}
              </Text>
            )}
            {attempts !== null && (
              <View className="mt-2.5 flex-row gap-2.5">
                {open ? (
                  <>
                    <Button
                      label="Postęp"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/attempt-progress",
                          params: { itemId: id, attemptId: open.id },
                        })
                      }
                    />
                    <Button
                      label="Zakończ"
                      onPress={() => showAttempt("finish", open)}
                    />
                    <Button
                      label="Porzuć"
                      variant="secondary"
                      onPress={() => showAttempt("abandon", open)}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      label="Zacznij"
                      onPress={() => showAttempt("start")}
                    />
                    <Button
                      label="Dodaj ukończone"
                      variant="secondary"
                      onPress={() => showAttempt("record")}
                    />
                  </>
                )}
              </View>
            )}
            <View className="mt-2.5 flex-row gap-2.5">
              <Button
                label="Edytuj pozycję"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/bibliography-item",
                    params: { itemId: id },
                  })
                }
              />
              <Button
                label="Usuń pozycję"
                variant="danger"
                onPress={confirmDelete}
              />
            </View>
            {errorMessage !== "" && (
              <Text className="mt-2 text-danger">{errorMessage}</Text>
            )}
            {attempts !== null && attempts.length > 0 && (
              <Text className="mt-5 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
                PODEJŚCIA
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          attempts !== null ? (
            <Text className="p-6 text-center text-xs text-muted">
              Brak podejść
            </Text>
          ) : undefined
        }
        renderItem={({ item: attempt }) => {
          const dates = attemptDates(attempt);
          const outcome = itemStatusLabel(attempt.outcome, item.kind);
          return (
            <Pressable
              className={common.row}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj podejście: ${outcome}${dates ? `, ${dates}` : ""}`}
              onPress={() => showAttempt("edit", attempt)}
            >
              <View className="flex-1">
                <Text className={common.rowTitle}>{outcome}</Text>
                {dates !== "" && (
                  <Text className={common.rowSubtitle}>{dates}</Text>
                )}
              </View>
              <Text className="text-[13px] font-semibold text-ink-soft">
                Edytuj
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
