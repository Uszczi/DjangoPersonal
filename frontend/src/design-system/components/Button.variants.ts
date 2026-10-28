/** The Button variants, as data so stories and controls stay in sync with the component. */
export const buttonVariants = [
  "primary",
  "secondary",
  "danger",
  "ghost",
  "ghostDanger",
] as const;

export type ButtonVariant = (typeof buttonVariants)[number];

const regularSize =
  "min-h-[40px] px-[15px] disabled:cursor-wait disabled:opacity-70";
const ghostSize =
  "min-h-[28px] px-[10px] disabled:cursor-not-allowed disabled:opacity-50";

export const buttonVariantStyles: Record<ButtonVariant, string> = {
  primary: `${regularSize} border-transparent bg-signal text-on-signal hover:-translate-y-px hover:bg-signal-strong`,
  secondary: `${regularSize} whitespace-nowrap border-control-border bg-transparent text-ink-soft hover:border-control-border-hover hover:bg-surface`,
  danger: `${regularSize} border-transparent bg-danger text-on-signal hover:-translate-y-px hover:bg-danger-strong`,
  ghost: `${ghostSize} border-transparent bg-transparent text-muted hover:bg-wash hover:text-ink`,
  ghostDanger: `${ghostSize} border-transparent bg-transparent text-danger hover:bg-signal-pale hover:text-danger-strong`,
};
