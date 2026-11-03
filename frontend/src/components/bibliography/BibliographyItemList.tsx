import {
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import {
  ITEM_KIND_LABELS,
  itemByline,
  rowStatusLabel,
} from "@personal/shared/bibliographyFormat";

/** The user's BibliographyItems, one row each: title, creator and year, kind and status. */
export function BibliographyItemList({
  items,
  onOpen,
}: {
  items: BibliographyItemResponse[];
  onOpen: (item: BibliographyItemResponse) => void;
}) {
  return (
    <ul className="flex flex-col" aria-label="Pozycje">
      {items.map((item) => {
        const byline = itemByline(item);
        const statusLabel = rowStatusLabel(item.status, item.kind);
        return (
          <ListRow key={item.id}>
            <ListRowButton
              aria-label={`Otwórz pozycję: ${item.title}`}
              onClick={() => onOpen(item)}
            >
              <div className="min-w-0">
                <ListRowTitle>{item.title}</ListRowTitle>
                {byline && <ListRowSubtitle>{byline}</ListRowSubtitle>}
              </div>
            </ListRowButton>
            <>
              <span className="mr-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                {ITEM_KIND_LABELS[item.kind]}
              </span>
              {statusLabel && (
                <span className="rounded-full border border-row-line px-2 py-0.5 text-[12px] text-ink-soft">
                  {statusLabel}
                </span>
              )}
            </>
          </ListRow>
        );
      })}
    </ul>
  );
}
