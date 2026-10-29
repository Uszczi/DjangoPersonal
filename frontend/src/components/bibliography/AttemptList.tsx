import {
  Button,
  ListRow,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import {
  attemptDates,
  itemStatusLabel,
  type ItemKind,
} from "@personal/shared/bibliographyFormat";
import type { AttemptResponse } from "@personal/shared/generated/api";

/** An item's Attempts, latest first as the server sends them: outcome and dates, each editable. */
export function AttemptList({
  attempts,
  kind,
  onEdit,
}: {
  attempts: AttemptResponse[];
  kind: ItemKind;
  onEdit: (attempt: AttemptResponse) => void;
}) {
  if (attempts.length === 0) {
    return <p className="py-4 text-[13px] text-muted">Brak podejść</p>;
  }

  return (
    <ul className="flex flex-col" aria-label="Podejścia">
      {attempts.map((attempt) => {
        const dates = attemptDates(attempt);
        return (
          <ListRow key={attempt.id}>
            <div className="min-w-0">
              <ListRowTitle>
                {itemStatusLabel(attempt.outcome, kind)}
              </ListRowTitle>
              {dates && <ListRowSubtitle>{dates}</ListRowSubtitle>}
            </div>
            <Button variant="ghost" onClick={() => onEdit(attempt)}>
              Edytuj
            </Button>
          </ListRow>
        );
      })}
    </ul>
  );
}
