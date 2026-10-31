/**
 * Class strings shared by many screens, the Uniwind counterparts of the web's
 * small layout components. Each value is one complete literal, so Tailwind
 * finds it when it scans the sources; never build these from parts.
 *
 * Two classes for the same property on one element give an undefined result
 * (the CSS cascade decides, not the order in `className`), so a variant that
 * changes a property is a full string of its own, like `card.kickerSignal`.
 */

export const common = {
  screen: "flex-1 bg-canvas",
  center: "flex-1 items-center justify-center bg-canvas p-6",
  error: "p-4 text-[13px] text-danger",
  muted: "text-xs text-muted",
  /** A list row (web `ListRow`): no card, a thin line underneath. */
  row: "mx-4 min-h-[62px] flex-row items-center gap-[13px] border-b border-row-line px-[3px] py-2.5",
  /** `row` that dims while pressed. */
  rowPressable:
    "mx-4 min-h-[62px] flex-row items-center gap-[13px] border-b border-row-line px-[3px] py-2.5 active:opacity-60",
  rowTitle: "text-sm font-medium text-ink",
  rowSubtitle: "mt-0.5 text-xs text-muted",
  /** Small all-caps line above a title (web `PageHeader` eyebrow). */
  eyebrow: "font-utility text-[11px] font-semibold tracking-[0.9px] text-muted",
  /** A page title (web `PageHeader`). */
  pageTitle:
    "font-display text-[28px] font-bold tracking-[-0.5px] text-ink",
  pageHeader: "gap-1 px-4 pt-5 pb-2",
  /** The boxed form error (web `ErrorAlert`). */
  alert:
    "border-l-[3px] border-l-signal bg-danger-pale px-[11px] py-[9px] text-xs leading-[18px] text-danger-ink",
} as const;

export const card = {
  /** A section card (web `TimerPanel`, `AuthCard`). */
  section:
    "mx-4 mt-4 gap-2 rounded-lg border border-card-line bg-paper p-5 shadow-[0_8px_18px_rgba(29,55,57,0.06)]",
  title: "font-display text-[22px] font-bold tracking-[-0.4px] text-ink",
  /** Small all-caps line in a card (web eyebrow). */
  kicker: "font-utility text-[11px] font-semibold tracking-[0.9px] text-muted",
  /** `kicker` in the signal colour, to flag state (a running timer). */
  kickerSignal:
    "font-utility text-[11px] font-semibold tracking-[0.9px] text-signal",
} as const;

export const form = {
  content: "gap-2 p-5",
  /** Field label (web `Field`). */
  label: "mt-2.5 text-xs font-semibold text-ink-soft",
  hint: "text-[11px] text-hint",
  input:
    "rounded border border-control-border bg-input px-[11px] py-2.5 text-[14px] text-ink",
  /** `input` for several lines of text. */
  multiline:
    "min-h-24 rounded border border-control-border bg-input px-[11px] py-2.5 text-[14px] text-ink align-top",
  error: "mt-2 text-xs text-danger-ink",
  /** The footer of an editor (web `ModalFooter`): a line above the buttons. */
  actions:
    "mt-[26px] flex-row gap-[9px] border-t border-line-soft pt-[18px]",
} as const;

