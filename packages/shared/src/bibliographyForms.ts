/**
 * The client-side checks of the Bibliography's forms, shared so the web and the
 * mobile app reject the same input with the same Polish message before the
 * server would.
 */

import type {
  AttemptRequest,
  AttemptResponse,
  PatchedAttemptRequest,
} from "./generated/api";

/**
 * What the Attempt form does: start a new Attempt, record one that already
 * ended, finish or abandon the one in progress, or re-date an existing one.
 * Nothing puts an ended Attempt back in progress: resuming starts a new one.
 */
export type AttemptAction = "start" | "record" | "finish" | "abandon" | "edit";

export const ATTEMPT_ACTIONS: readonly AttemptAction[] = [
  "start",
  "record",
  "finish",
  "abandon",
  "edit",
];

export const ATTEMPT_TITLES: Record<AttemptAction, string> = {
  start: "Zacznij podejście",
  record: "Dodaj ukończone podejście",
  finish: "Zakończ podejście",
  abandon: "Porzuć podejście",
  edit: "Edytuj podejście",
};

export const ATTEMPT_SUBMIT_LABELS: Record<AttemptAction, string> = {
  start: "Zacznij",
  record: "Zapisz",
  finish: "Zakończ",
  abandon: "Porzuć",
  edit: "Zapisz",
};

/** Whether the action changes an existing Attempt (so it needs one). */
export function actionNeedsAttempt(action: AttemptAction) {
  return action === "finish" || action === "abandon" || action === "edit";
}

/**
 * Which dates the form asks for: the start whenever it is new or re-dated,
 * the end whenever the Attempt is (or becomes) ended.
 */
export function attemptFormFields(
  action: AttemptAction,
  attempt: Pick<AttemptResponse, "outcome"> | null,
) {
  return {
    showsStart: action === "start" || action === "record" || action === "edit",
    showsEnd:
      action === "record" ||
      action === "finish" ||
      action === "abandon" ||
      (action === "edit" && attempt?.outcome !== "in_progress"),
  };
}

/** The request an Attempt form sends: a new Attempt, or changes to one. */
export type AttemptWrite =
  | { create: AttemptRequest }
  | { update: { id: number; changes: PatchedAttemptRequest } };

/**
 * What submitting the form for `action` sends. Only the dates the form shows
 * are sent; `attempt` is required for the actions that change one.
 */
export function attemptWrite(
  action: AttemptAction,
  {
    itemId,
    attempt,
    startedOn,
    endedOn,
  }: {
    itemId: number;
    attempt: AttemptResponse | null;
    startedOn: Date | null;
    endedOn: Date | null;
  },
): AttemptWrite {
  switch (action) {
    case "start":
      return {
        create: { item: itemId, outcome: "in_progress", startedOn, endedOn: null },
      };
    case "record":
      return {
        create: { item: itemId, outcome: "finished", startedOn, endedOn },
      };
  }
  if (!attempt) throw new Error("No Attempt to change.");
  switch (action) {
    case "finish":
    case "abandon":
      return {
        update: {
          id: attempt.id,
          changes: {
            outcome: action === "finish" ? "finished" : "abandoned",
            endedOn,
          },
        },
      };
    case "edit":
      return {
        update: {
          id: attempt.id,
          changes: attemptFormFields(action, attempt).showsEnd
            ? { startedOn, endedOn }
            : { startedOn },
        },
      };
  }
}

/**
 * The problem with an ended Attempt's dates (`yyyy-mm-dd` keys, the start
 * optional), or `""` when they are fine.
 */
export function attemptDatesError({
  startedOn,
  endedOn,
}: {
  startedOn: string;
  endedOn: string;
}) {
  if (!endedOn) return "Podaj datę zakończenia.";
  if (startedOn && endedOn < startedOn) {
    return "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.";
  }
  return "";
}

/**
 * An Attempt's progress typed in a field: a whole number up to the item's
 * length (when known), or `null` for an empty field, which clears it.
 */
export function parseProgress(
  text: string,
  length: number | null,
): { value: number | null } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Postęp musi być nieujemną liczbą całkowitą." };
  }
  const value = Number(trimmed);
  if (length !== null && value > length) {
    return { error: `Postęp nie może przekraczać długości (${length}).` };
  }
  return { value };
}

/**
 * A BibliographyItem's year or length typed in a field: `null` when empty, the
 * number when it is a positive whole number, `undefined` when it is invalid.
 */
export function parseItemNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value > 0 ? value : undefined;
}
