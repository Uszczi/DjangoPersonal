import type { ButtonHTMLAttributes } from "react";

import { DeleteIcon } from "../icons/DeleteIcon";
import { EditIcon } from "../icons/EditIcon";
import { IconButton } from "./IconButton";

/** An icon-only button needs a name: `aria-label` says what it acts on, e.g. "Edytuj portfel: Personal". */
type RowActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
};

/** The pencil button of a list row. `title` defaults to the plain verb shown on hover. */
export function EditButton({ title = "Edytuj", className = "", ...props }: RowActionButtonProps) {
  return (
    <IconButton title={title} className={`text-[18px] hover:text-ink ${className}`.trim()} {...props}>
      <EditIcon />
    </IconButton>
  );
}

/** The bin button of a list row. */
export function DeleteButton({ title = "Usuń", className = "", ...props }: RowActionButtonProps) {
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
