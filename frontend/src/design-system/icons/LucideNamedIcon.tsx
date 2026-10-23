import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";

const knownNames: ReadonlySet<string> = new Set(iconNames);

function isIconName(name: string): name is IconName {
  return knownNames.has(name);
}

type LucideNamedIconProps = {
  name: string;
  fallback: string;
  className: string;
};

/**
 * `NamedIcon`'s body, loaded lazily: lucide's name → chunk map is large, so it
 * lives in this module's chunk rather than in the main bundle.
 */
export default function LucideNamedIcon({ name, fallback, className }: LucideNamedIconProps) {
  const shown = isIconName(name) ? name : isIconName(fallback) ? fallback : "tag";
  return (
    <DynamicIcon
      name={shown}
      className={className}
      aria-hidden="true"
      focusable="false"
      fallback={() => <span className={`inline-block ${className}`} aria-hidden="true" />}
    />
  );
}
