import { ToggleGroup } from "@/design-system";
import {
  ITEM_KINDS,
  ITEM_STATUSES,
  itemStatusFilterLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import type { BibliographyItemFilters as Filters } from "@personal/shared/queries/bibliographyItems";

const ALL = "all";

const KIND_FILTER_LABELS: Record<ItemKind | typeof ALL, string> = {
  all: "Wszystkie",
  film: "Filmy",
  book: "Książki",
};

/** Narrow the BibliographyItem list by status and kind; "all" clears a filter. */
export function BibliographyItemFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const { status, kind } = filters;
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
    <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
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
    </div>
  );
}
