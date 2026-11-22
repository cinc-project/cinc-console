import { useId, type ReactNode } from "react";

/**
 * A bordered sheet of DetailRows: the compact layout for a user or client page,
 * where each slice of the object is one row and its forms open on demand.
 */
export function DetailSheet({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-[var(--shadow-sm)]">
      {children}
    </div>
  );
}

/**
 * One row: a small heading on the left, the content in the middle and an
 * optional action on the right. Below `sm` the heading goes on its own line.
 * Usable from server and client components alike.
 */
export function DetailRow({
  label,
  action,
  children,
}: {
  label: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-5 gap-y-1.5 px-4 py-3.5 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:px-5"
    >
      <h2
        id={id}
        className="col-span-2 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted sm:col-span-1"
      >
        {label}
      </h2>
      <div className="min-w-0 text-sm text-text">{children}</div>
      <div className="flex items-start gap-2">{action}</div>
    </section>
  );
}

/** "Not set" for an empty profile field, muted so it can't pass for a value. */
export function Unset() {
  return <span className="italic text-muted">Not set</span>;
}
