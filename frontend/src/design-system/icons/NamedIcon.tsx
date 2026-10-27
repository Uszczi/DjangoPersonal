import { lazy, Suspense } from "react";

const LucideNamedIcon = lazy(() => import("./LucideNamedIcon"));

type NamedIconProps = {
  /** A lucide icon name; an unknown one renders `fallback` instead. */
  name: string;
  fallback?: string;
  className?: string;
};

/**
 * Any lucide icon, by name. Both the name map and each icon load lazily, so
 * the icon set never lands in the main bundle; until an icon arrives an empty
 * box of the same size holds its place. Decorative: a label always sits next
 * to it.
 */
export function NamedIcon({
  name,
  fallback = "tag",
  className = "",
}: NamedIconProps) {
  const classes = `size-4 shrink-0 ${className}`.trim();
  return (
    <Suspense
      fallback={
        <span className={`inline-block ${classes}`} aria-hidden="true" />
      }
    >
      <LucideNamedIcon name={name} fallback={fallback} className={classes} />
    </Suspense>
  );
}
