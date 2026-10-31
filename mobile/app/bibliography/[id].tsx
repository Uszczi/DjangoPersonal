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
import { makeStyles, fonts, useTheme } from "../../src/theme";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

/** One film or book: its derived status, the actions its Attempts allow, and their history. */
export default function BibliographyItemScreen() {
  const { common } = useTheme();
  const styles = useStyles();
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
      <View style={common.center}>
        <Text style={common.muted}>
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
    <View style={common.screen}>
      <Stack.Screen options={{ title: ITEM_KIND_LABELS[item.kind] }} />
      <FlatList
        data={attempts ?? []}
        keyExtractor={(attempt) => String(attempt.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={
              isRefreshing || (attempts === null && attemptsError === "")
            }
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={common.pageTitle}>{item.title}</Text>
            {byline !== "" && <Text style={common.muted}>{byline}</Text>}
            <View style={styles.meta}>
              <Text style={common.eyebrow}>
                {ITEM_KIND_LABELS[item.kind].toUpperCase()}
              </Text>
              <Text style={styles.status} accessibilityLabel="Status">
                {itemStatusLabel(item.status, item.kind)}
              </Text>
            </View>
            {item.note !== "" && <Text style={styles.note}>{item.note}</Text>}
            {progress !== "" && (
              <Text style={styles.progress} accessibilityLabel="Postęp">
                {progress}
              </Text>
            )}
            {attempts !== null && (
              <View style={styles.actions}>
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
            <View style={styles.actions}>
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
              <Text style={styles.error}>{errorMessage}</Text>
            )}
            {attempts !== null && attempts.length > 0 && (
              <Text style={[common.eyebrow, styles.sectionTitle]}>
                PODEJŚCIA
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          attempts !== null ? (
            <Text style={[common.muted, styles.empty]}>Brak podejść</Text>
          ) : undefined
        }
        renderItem={({ item: attempt }) => {
          const dates = attemptDates(attempt);
          const outcome = itemStatusLabel(attempt.outcome, item.kind);
          return (
            <Pressable
              style={common.row}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj podejście: ${outcome}${dates ? `, ${dates}` : ""}`}
              onPress={() => showAttempt("edit", attempt)}
            >
              <View style={{ flex: 1 }}>
                <Text style={common.rowTitle}>{outcome}</Text>
                {dates !== "" && (
                  <Text style={common.rowSubtitle}>{dates}</Text>
                )}
              </View>
              <Text style={styles.edit}>Edytuj</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  listContent: { paddingBottom: 32 },
  header: { padding: 16, gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  // The web's status pill.
  status: {
    borderWidth: 1,
    borderColor: colors.rowLine,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 13,
    color: colors.inkSoft,
  },
  note: { fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  progress: {
    fontFamily: fonts.utility,
    fontSize: 15,
    color: colors.inkSoft,
    marginTop: 6,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  error: { color: colors.danger, marginTop: 8 },
  sectionTitle: { marginTop: 20 },
  empty: { padding: 24, textAlign: "center" },
  edit: { color: colors.inkSoft, fontSize: 13, fontWeight: "600" },
}));
