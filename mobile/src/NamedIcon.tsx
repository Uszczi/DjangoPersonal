import * as icons from "lucide-react-native/icons";
import type { ComponentType } from "react";

type IconProps = { color?: string; size?: number; strokeWidth?: number };

const iconsByName = icons as unknown as Record<
  string,
  ComponentType<IconProps> | undefined
>;

/** `piggy-bank` → `PiggyBank`, `gamepad-2` → `Gamepad2`: lucide's component names. */
function componentName(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

type NamedIconProps = IconProps & {
  /** A lucide icon name as the API stores it, e.g. `piggy-bank`. */
  name: string;
  /** Drawn when `name` is not a lucide icon (or is empty). */
  fallback: string;
};

/** A wallet or category icon by its stored lucide name, like the web `NamedIcon`. */
export function NamedIcon({
  name,
  fallback,
  size = 20,
  ...props
}: NamedIconProps) {
  const Icon =
    iconsByName[componentName(name)] ?? iconsByName[componentName(fallback)];
  return Icon ? <Icon size={size} {...props} /> : null;
}
