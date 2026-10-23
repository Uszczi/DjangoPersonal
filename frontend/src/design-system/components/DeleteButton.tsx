import type { ButtonHTMLAttributes } from "react";

import { DeleteIcon } from "../icons/DeleteIcon";
import { IconButton } from "./IconButton";

/** An icon-only button needs a name: `aria-label` says what it acts on, e.g. "Usuń portfel: Personal". */
type DeleteButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
};

/** The bin button of a list row. */
export function DeleteButton({ title = "Usuń", className = "", ...props }: DeleteButtonProps) {
  return (
    <IconButton
      title={title}
      className={`text-[18px] hover:bg-danger-pale hover:text-danger ${className}`.trim()}
      {...props}
    >
      <DeleteIcon />
    </IconButton>
  );
}
