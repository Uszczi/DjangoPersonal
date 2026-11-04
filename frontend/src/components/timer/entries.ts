export type TaskTitles = Map<string, string>;

export { entryTitle } from "@personal/shared/timeLog";

export type EntryFormValues = { date: string; title: string; minutes: string };

/** Checks a manual or edited entry; returns the input to send, or the error to show. */
export function parseEntryForm(
  form: EntryFormValues,
):
  | { input: { date: string; title: string; minutes: number } }
  | { error: string } {
  const title = form.title.trim();
  const minutes = Number(form.minutes);
  if (!form.date) return { error: "Podaj datę wpisu." };
  if (!title) return { error: "Podaj tytuł zadania." };
  if (!Number.isInteger(minutes) || minutes < 1) {
    return { error: "Podaj czas trwania w minutach (co najmniej 1)." };
  }
  return { input: { date: form.date, title, minutes } };
}
