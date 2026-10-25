import type { ReactNode } from "react";

type EmptyStateProps = {
  /** Small all-caps line above the title, e.g. "BRAK PROJEKTÓW". */
  eyebrow: ReactNode;
  title: ReactNode;
  /** `h1` when the page has no `PageHeader` of its own; the title is then larger. */
  titleAs?: "h1" | "h2";
  /** Actions under the title, usually the button that creates the first item. */
  children?: ReactNode;
};

/** What a page shows in place of a list that has nothing in it yet. */
export function EmptyState({ eyebrow, title, titleAs = "h2", children }: EmptyStateProps) {
  const Title = titleAs;
  return (
    <div className="pt-[40px] text-muted">
      <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">{eyebrow}</p>
      <Title
        className={`mt-2 font-display font-bold tracking-[-0.02em] text-ink ${titleAs === "h1" ? "text-[28px]" : "text-[24px]"}`}
      >
        {title}
      </Title>
      {children && <div className="mt-5 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
