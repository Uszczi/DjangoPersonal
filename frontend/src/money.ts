/**
 * Validation shared by the wallet modals' money fields — the opening balance
 * on create and the current balance on edit. Both may be blank (the field is
 * optional) and both may be negative, so only the shape is checked here; the
 * server owns the final say.
 */
export function balanceError(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (Number.isNaN(Number(value))) return "Podaj poprawną kwotę.";
  const fraction = value.split(".")[1];
  if (fraction && fraction.length > 2) {
    return "Kwota może mieć maksymalnie 2 miejsca dziesiętne.";
  }
  return "";
}
