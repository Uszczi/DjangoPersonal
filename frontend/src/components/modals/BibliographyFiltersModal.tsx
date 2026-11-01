import { Eye, EyeOff } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Modal, ModalFooter, ToggleGroup } from "@/design-system";
import {
  ITEM_KIND_FILTER_LABELS,
  ITEM_KINDS,
  ITEM_STATUSES,
  itemStatusFilterLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import type { BibliographyItemFilters as Filters } from "@personal/shared/queries/bibliographyItems";
import {
  useBibliographyViewStore,
  type BibliographyViewMode,
} from "@personal/shared/stores/bibliographyView";

const ALL = "all";

const VIEW_MODES: BibliographyViewMode[] = ["items", "years"];

const VIEW_MODE_LABELS: Record<BibliographyViewMode, string> = {
  items: "Pozycje",
  years: "Lata",
};

const KIND_FILTER_LABELS: Record<ItemKind | typeof ALL, string> = {
  all: "Wszystkie",
  ...ITEM_KIND_FILTER_LABELS,
};

/**
 * Every Bibliografia filter and the view settings in one dialog, opened from
 * the Filtry button beside the search, so the list starts right under it.
 * Choices apply at once.
 */
export function BibliographyFiltersModal({
  filters,
  onChange,
  onFoldAll,
  onUnfoldAll,
  onClose,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onFoldAll: () => void;
  onUnfoldAll: () => void;
  onClose: () => void;
}) {
  const { status, kind } = filters;
  const viewMode = useBibliographyViewStore((state) => state.mode);
  const setViewMode = useBibliographyViewStore((state) => state.setMode);
  const dividers = useBibliographyViewStore((state) => state.dividers);
  const setDividers = useBibliographyViewStore((state) => state.setDividers);
  const statusLabels = {
    all: "Wszystkie",
    ...Object.fromEntries(
      ITEM_STATUSES.map((option) => [
        option,
        itemStatusFilterLabel(option, kind),
      ]),
    ),
  } as Record<ItemStatus | typeof ALL, string>;

  return (
    <Modal
      kicker="BIBLIOGRAFIA"
      title="Filtry i widok"
      titleId="bibliography-filters-title"
      onClose={onClose}
    >
      <Section title="Widok">
        <ToggleGroup
          label="Widok Bibliografii"
          options={VIEW_MODES}
          labels={VIEW_MODE_LABELS}
          value={viewMode}
          onChange={setViewMode}
        />
        {viewMode === "years" && (
          <div className="mt-2 flex flex-wrap gap-1">
            <Button variant="ghost" onClick={onFoldAll}>
              Zwiń wszystko
            </Button>
            <Button variant="ghost" onClick={onUnfoldAll}>
              Rozwiń wszystko
            </Button>
            <Button
              variant="ghost"
              aria-pressed={!dividers}
              onClick={() => setDividers(!dividers)}
            >
              {dividers ? (
                <EyeOff aria-hidden="true" className="size-[14px]" />
              ) : (
                <Eye aria-hidden="true" className="size-[14px]" />
              )}
              {dividers ? "Ukryj podziały" : "Pokaż podziały"}
            </Button>
          </div>
        )}
      </Section>
      <Section title="Rodzaj">
        <ToggleGroup
          label="Filtr rodzaju"
          className="flex-wrap"
          options={[ALL, ...ITEM_KINDS]}
          labels={KIND_FILTER_LABELS}
          value={kind ?? ALL}
          onChange={(value) =>
            onChange({ status, kind: value === ALL ? undefined : value })
          }
        />
      </Section>
      <Section title="Status">
        <ToggleGroup
          label="Filtr statusu"
          className="flex-wrap"
          options={[ALL, ...ITEM_STATUSES]}
          labels={statusLabels}
          value={status ?? ALL}
          onChange={(value) =>
            onChange({ kind, status: value === ALL ? undefined : value })
          }
        />
      </Section>
      <ModalFooter>
        {(kind !== undefined || status !== undefined) && (
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() => onChange({})}
          >
            Wyczyść filtry
          </Button>
        )}
        <Button variant="primary" onClick={onClose}>
          Gotowe
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="m-0 mb-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
