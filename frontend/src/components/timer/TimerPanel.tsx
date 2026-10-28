import type { ReactNode } from "react";

/** The card every section of the Timer page sits in, with an optional heading row. */
export function TimerPanel({
  title,
  headingId,
  label,
  actions,
  children,
}: {
  title?: string;
  headingId?: string;
  label?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="mb-6 rounded-[7px] border border-card-line bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]"
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : label}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h2
            id={headingId}
            className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink"
          >
            {title}
          </h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function FormLabel({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
        {text}
      </span>
      {children}
    </label>
  );
}
