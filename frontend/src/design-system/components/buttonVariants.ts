/** The Button variants, as data so stories and controls stay in sync with the component. */
export const buttonVariants = [
  "primary",
  "secondary",
  "danger",
  "ghost",
  "ghostDanger",
] as const;

export type ButtonVariant = (typeof buttonVariants)[number];
