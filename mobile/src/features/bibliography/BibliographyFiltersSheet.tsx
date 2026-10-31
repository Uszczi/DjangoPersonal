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

import { ChipGroup } from "@/ui/ChipGroup";
import { Sheet } from "@/ui/Sheet";
import { KIND_FILTER_LABELS } from "@/features/bibliography/filterLabels";

/** A chip value for "no filter": ChipGroup needs a value for every option. */
const ALL = "all";

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
      <View className="gap-[18px] py-2">
        <Section title="Widok">
          <ChipGroup
            options={VIEW_MODES}
            value={viewMode}
            onChange={setViewMode}
          />
          {viewMode === "years" && (
            <View className="flex-row flex-wrap gap-4">
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
  return (
    <View className="gap-2">
      <Text
        className="font-utility text-[11px] font-semibold tracking-[0.9px] text-muted"
        accessibilityRole="header"
      >
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      className="active:opacity-60"
    >
      <Text className="text-[13px] text-muted">{label}</Text>
    </Pressable>
  );
}
