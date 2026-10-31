import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import {
  ITEM_STATUSES,
  itemStatusFilterLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import {
  useBibliographyViewStore,
  type BibliographyViewMode,
} from "@personal/shared/stores/bibliographyView";

import { ChipGroup } from "../../ui/ChipGroup";
import { Sheet } from "../../ui/Sheet";
import { fonts, makeStyles } from "../../theme";

/** A chip value for "no filter": ChipGroup needs a value for every option. */
const ALL = "all";

export const KIND_FILTER_LABELS: Record<ItemKind, string> = {
  film: "Filmy",
  book: "Książki",
};

const KIND_FILTERS: { value: ItemKind | typeof ALL; label: string }[] = [
  { value: ALL, label: "Wszystkie" },
  { value: "film", label: KIND_FILTER_LABELS.film },
  { value: "book", label: KIND_FILTER_LABELS.book },
];

const VIEW_MODES: { value: BibliographyViewMode; label: string }[] = [
  { value: "items", label: "Pozycje" },
  { value: "years", label: "Lata" },
];

/**
 * Every Bibliografia filter and the view settings in one popup, opened from
 * the Filtry button beside the search: on a phone they took half the screen
 * as rows of chips above the list.
 */
export function BibliographyFiltersSheet({
  kind,
  onKindChange,
  status,
  onStatusChange,
  hasYears,
  onFoldAll,
  onUnfoldAll,
  onClose,
}: {
  kind: ItemKind | undefined;
  onKindChange: (kind: ItemKind | undefined) => void;
  status: ItemStatus | undefined;
  onStatusChange: (status: ItemStatus | undefined) => void;
  /** Whether the year view has any years to fold. */
  hasYears: boolean;
  onFoldAll: () => void;
  onUnfoldAll: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const viewMode = useBibliographyViewStore((state) => state.mode);
  const setViewMode = useBibliographyViewStore((state) => state.setMode);
  const dividers = useBibliographyViewStore((state) => state.dividers);
  const setDividers = useBibliographyViewStore((state) => state.setDividers);
  const statusFilters: { value: ItemStatus | typeof ALL; label: string }[] = [
    { value: ALL, label: "Wszystkie" },
    ...ITEM_STATUSES.map((value) => ({
      value,
      label: itemStatusFilterLabel(value, kind),
    })),
  ];

  return (
    <Sheet title="Filtry i widok" onClose={onClose}>
      <View style={styles.body}>
        <Section title="Widok">
          <ChipGroup
            options={VIEW_MODES}
            value={viewMode}
            onChange={setViewMode}
          />
          {viewMode === "years" && (
            <View style={styles.yearActions}>
              {dividers && hasYears && (
                <>
                  <TextButton label="Zwiń wszystko" onPress={onFoldAll} />
                  <TextButton label="Rozwiń wszystko" onPress={onUnfoldAll} />
                </>
              )}
              <TextButton
                label={dividers ? "Ukryj podziały" : "Pokaż podziały"}
                onPress={() => setDividers(!dividers)}
              />
            </View>
          )}
        </Section>
        <Section title="Rodzaj">
          <ChipGroup
            options={KIND_FILTERS}
            value={kind ?? ALL}
            onChange={(value) =>
              onKindChange(value === ALL ? undefined : value)
            }
          />
        </Section>
        <Section title="Status">
          <ChipGroup
            options={statusFilters}
            value={status ?? ALL}
            onChange={(value) =>
              onStatusChange(value === ALL ? undefined : value)
            }
          />
        </Section>
        {(kind !== undefined || status !== undefined) && (
          <TextButton
            label="Wyczyść filtry"
            onPress={() => {
              onKindChange(undefined);
              onStatusChange(undefined);
            }}
          />
        )}
      </View>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function TextButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Text style={styles.textButton}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  body: { paddingVertical: 8, gap: 18 },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
  yearActions: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  textButton: { fontSize: 13, color: colors.muted },
  pressed: { opacity: 0.6 },
}));
