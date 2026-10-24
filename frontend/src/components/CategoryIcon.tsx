import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import { NamedIcon } from "@/design-system";

type CategoryIconProps = {
  icon: string;
  className?: string;
};

/** A category's icon, decorative: the category's name always sits next to it. */
export function CategoryIcon({ icon, className }: CategoryIconProps) {
  return <NamedIcon name={icon} fallback={DEFAULT_CATEGORY_ICON} className={className} />;
}
