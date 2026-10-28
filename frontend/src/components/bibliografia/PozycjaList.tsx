import {
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import type { PozycjaResponse } from "@personal/shared/generated/api";
import {
  POZYCJA_KIND_LABELS,
  pozycjaByline,
  pozycjaStatusLabel,
} from "@personal/shared/pozycjaFormat";

/** The user's Pozycje, one row each: title, creator and year, kind and status. */
export function PozycjaList({
  pozycje,
  onEdit,
}: {
  pozycje: PozycjaResponse[];
  onEdit: (pozycja: PozycjaResponse) => void;
}) {
  return (
    <ul className="flex flex-col" aria-label="Pozycje">
      {pozycje.map((pozycja) => {
        const byline = pozycjaByline(pozycja);
        return (
          <ListRow key={pozycja.id}>
            <ListRowButton
              aria-label={`Edytuj pozycję: ${pozycja.title}`}
              onClick={() => onEdit(pozycja)}
            >
              <div className="min-w-0">
                <ListRowTitle>{pozycja.title}</ListRowTitle>
                {byline && <ListRowSubtitle>{byline}</ListRowSubtitle>}
              </div>
            </ListRowButton>
            <>
              <span className="mr-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                {POZYCJA_KIND_LABELS[pozycja.kind]}
              </span>
              <span className="rounded-full border border-row-line px-2 py-0.5 text-[12px] text-ink-soft">
                {pozycjaStatusLabel(pozycja.status, pozycja.kind)}
              </span>
            </>
          </ListRow>
        );
      })}
    </ul>
  );
}
