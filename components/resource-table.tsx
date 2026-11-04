"use client";

import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { PageHeader } from "./ui/page-header";
import { SortableTh } from "./ui/sortable";
import { useSort } from "./ui/use-sort";
import { applyDir, byString, type SortState } from "@/lib/sort";

/** Single-column lists sort by name only; direction is the user's to choose. */
const SORT_KEYS = ["name"] as const;
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" };

/** Rows rendered per page. The Cinc list call returns every name at once, so
 * this only bounds the DOM — it keeps large orgs (thousands of nodes) snappy. */
const PAGE_SIZE = 50;

/** A searchable, paginated list of object names that link to their detail pages. */
export function ResourceTable({
  title,
  names,
  basePath,
  createHref,
  empty,
  builtIn = [],
}: {
  title: string;
  names: string[];
  basePath: string;
  createHref?: string;
  /** The EmptyState shown when the org has none of this object yet. */
  empty?: ReactNode;
  /**
   * Names the server creates on its own (`_default`, the org validator). A
   * list holding only these still counts as empty, so a new org gets the
   * empty state rather than a one-row table; the page's `empty` should link
   * to them so they stay reachable.
   */
  builtIn?: string[];
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const { sort, setSort } = useSort("sort", DEFAULT_SORT, SORT_KEYS);
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return names
      .filter((n) => n.toLowerCase().includes(needle))
      .sort((a, b) => applyDir(byString(a, b), sort.dir));
  }, [names, q, sort.dir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp during render so a shrinking filter can never strand us past the end.
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function onFilter(value: string) {
    setQ(value);
    setPage(0);
  }

  // The empty state carries its own call to action, so the header's "New"
  // button and the filter box (nothing to filter) are left out.
  if (empty && names.every((n) => builtIn.includes(n))) {
    return (
      <div className="space-y-4">
        <PageHeader title={title} />
        {empty}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        actions={
          createHref && (
            <Link href={createHref}>
              <Button>New</Button>
            </Link>
          )
        }
      />

      <Input
        placeholder={`Filter ${title.toLowerCase()}…`}
        value={q}
        onChange={(e) => onFilter(e.target.value)}
        className="max-w-xs"
      />

      <div className="overflow-hidden rounded-lg border border-border">
        {names.length === 0 ? (
          <div className="p-4 text-sm text-muted">
            <p>No {title.toLowerCase()} in this organization yet.</p>
            {createHref && (
              <Link
                href={createHref}
                className="mt-2 inline-block text-link hover:underline"
              >
                Create one &rarr;
              </Link>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            No {title.toLowerCase()} matching &ldquo;{q}&rdquo;.
          </p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{title}, sortable by name</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <SortableTh
                  label="Name"
                  sortKey="name"
                  sort={sort}
                  onSort={setSort}
                />
              </tr>
            </thead>
            <tbody>
              {visible.map((name) => (
                <tr
                  key={name}
                  className="border-b border-border last:border-0 hover:bg-surface-2"
                >
                  <td className="p-0">
                    <Link
                      href={`${basePath}/${encodeURIComponent(name)}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 font-mono text-sm text-text transition-colors hover:text-link"
                    >
                      <span className="truncate">{name}</span>
                      <span aria-hidden="true" className="text-muted">
                        →
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {filtered.length === 0
            ? `0 of ${names.length}`
            : `${start + 1}–${start + visible.length} of ${filtered.length}` +
              (filtered.length === names.length ? "" : ` (${names.length} total)`)}
        </span>
        {pageCount > 1 && (
          <span className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              aria-label="Previous page"
            >
              Prev
            </Button>
            <span>
              {current + 1} / {pageCount}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount - 1}
              aria-label="Next page"
            >
              Next
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
