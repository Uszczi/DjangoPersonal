import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  /** Small all-caps line above the title: a label ("KONTO") or a back link. */
  eyebrow?: ReactNode;
  /** A muted line under the title (e.g. a count or the current project). */
  subtitle?: ReactNode;
  /** Shown left of the title block (e.g. a menu toggle). */
  leading?: ReactNode;
  /** Shown on the right of the title: buttons, a total, a save state. */
  actions?: ReactNode;
  /** Id of the `<h1>`, for `aria-labelledby`. */
  titleId?: string;
  /** Makes the title a button, e.g. to rename the page's object. */
  onTitleClick?: () => void;
  /** Accessible name of the title button. */
  titleClickLabel?: string;
  /** Rendered instead of the title while it is being edited in place. */
  titleEditor?: ReactNode;
};

const titleClasses =
  "font-display text-[28px] font-bold tracking-[-0.02em] text-ink";

/** The top of every page: its `<h1>` and the page-wide actions. */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  leading,
  actions,
  titleId,
  onTitleClick,
  titleClickLabel,
  titleEditor,
}: PageHeaderProps) {
  const heading = (
    <h1 id={titleId} className={titleClasses}>
      {title}
    </h1>
  );

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
              {eyebrow}
            </div>
          )}
          {titleEditor ||
            (onTitleClick ? (
              // The button covers the heading instead of wrapping it: a button's
              // content is not exposed as a heading to assistive technology.
              <div className="relative -mx-1 rounded px-1 hover:bg-wash">
                {heading}
                <button
                  type="button"
                  aria-label={titleClickLabel}
                  title={titleClickLabel}
                  onClick={onTitleClick}
                  className="absolute inset-0 cursor-pointer rounded"
                />
              </div>
            ) : (
              heading
            ))}
          {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
