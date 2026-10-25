import { ListRow, ListRowButton, ListRowSubtitle, ListRowTitle } from "@/design-system";
import { formatEntryTime, signedValue } from "@personal/shared/counterFormat";
import type { CounterEntryResponse } from "@personal/shared/generated/api";

/** A Counter's entries, newest first as the server sends them; a row opens its editor. */
export function CounterEntryList({
  entries,
  onEdit,
}: {
  entries: CounterEntryResponse[];
  onEdit: (entry: CounterEntryResponse) => void;
}) {
  if (entries.length === 0) {
    return <p className="py-4 text-[13px] text-muted">Brak wpisów. Dodaj pierwszy wpis.</p>;
  }

  return (
    <ul className="flex flex-col" aria-label="Wpisy">
      {entries.map((entry) => (
        <ListRow key={entry.id}>
          <ListRowButton
            aria-label={`Edytuj wpis ${signedValue(entry.value)} z ${formatEntryTime(entry.occurredAt)}`}
            onClick={() => onEdit(entry)}
          >
            <div className="min-w-0">
              <ListRowTitle>{formatEntryTime(entry.occurredAt)}</ListRowTitle>
              {entry.note && <ListRowSubtitle multiline>{entry.note}</ListRowSubtitle>}
            </div>
          </ListRowButton>
          <span
            className={`font-utility text-[14px] font-semibold ${entry.value < 0 ? "text-danger" : "text-ink"}`}
          >
            {signedValue(entry.value)}
          </span>
        </ListRow>
      ))}
    </ul>
  );
}
