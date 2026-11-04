"use client";

import { useId } from "react";
import { serializeSort, type SortState } from "@/lib/sort";

export type SortOption = { label: string; sort: SortState };

/**
 * The phone-width stand-in for sortable column headers: when a list renders as
 * stacked cards there are no headers to tap, so one native <select> picks the
 * column and direction together. Native, so it gets the platform picker and
 * full keyboard/screen-reader support for free. If the current sort isn't one
 * of the options (set from the desktop table), a matching entry is shown so the
 * control never lies about the order on screen.
 */
export function SortSelect({
  options,
  value,
  onChange,
  className,
}: {
  options: SortOption[];
  value: SortState;
  onChange: (next: SortState) => void;
  className?: string;
}) {
  const id = useId();
  const current = serializeSort(value);
  const known = options.some((o) => serializeSort(o.sort) === current);
  return (
    <div className={className}>
      <label htmlFor={id} className="mr-2 text-sm text-muted">
        Sort by
      </label>
      <select
        id={id}
        value={current}
        onChange={(e) => {
          const pick = options.find((o) => serializeSort(o.sort) === e.target.value);
          if (pick) onChange(pick.sort);
        }}
        className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {!known && <option value={current}>Custom</option>}
        {options.map((o) => (
          <option key={serializeSort(o.sort)} value={serializeSort(o.sort)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
