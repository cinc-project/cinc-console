import { useId, type ReactNode } from "react";

/**
 * The "nothing here yet" block for an object list: an illustration, a headline
 * saying what the object is, one sentence on why you'd want one, and the next
 * step — a button when the console can do it, a CommandSnippet when it can't.
 * Distinct from "no rows match your filter", which stays a one-line note.
 */
export function EmptyState({
  illustration,
  title,
  children,
  actions,
}: {
  illustration: ReactNode;
  title: ReactNode;
  /** One sentence: what this object is for. */
  children: ReactNode;
  /** The call to action (buttons, links, a CommandSnippet). */
  actions?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-4 py-8 text-center shadow-[var(--shadow-sm)] sm:px-6 sm:py-10"
    >
      <div aria-hidden="true" className="text-link">
        {illustration}
      </div>
      <h2 id={titleId} className="text-base font-semibold text-text">
        {title}
      </h2>
      <p className="max-w-md text-sm text-muted">{children}</p>
      {actions && (
        <div className="mt-1 flex w-full max-w-lg flex-col items-center gap-3">
          {actions}
        </div>
      )}
    </section>
  );
}
