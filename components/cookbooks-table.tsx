"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { EmptyState } from "@/components/empty-state";
import { CommandSnippet } from "@/components/command-snippet";
import { CookbooksIllustration } from "@/components/illustrations";
import { PageHeader } from "./ui/page-header";
import { SortableTh } from "./ui/sortable";
import { useSort } from "./ui/use-sort";
import {
  applyDir,
  byNumber,
  byString,
  nullsLast,
  type SortState,
} from "@/lib/sort";
import { compareVersions } from "@/lib/cinc/fleet";
import type { CookbookSummary } from "@/lib/cinc/cookbooks";

const SORT_KEYS = ["name", "latest", "count"] as const;
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" };

/** Bounds the DOM only — the Cinc list call returns every cookbook at once. */
const PAGE_SIZE = 50;

/** Order two summaries by the active column; cookbooks with no version sort last. */
function compareBy(a: CookbookSummary, b: CookbookSummary, sort: SortState): number {
  switch (sort.key) {
    case "latest":
      return nullsLast<string>((x, y) => applyDir(compareVersions(x, y), sort.dir))(
        a.latest,
        b.latest,
      );
    case "count":
      return applyDir(byNumber(a.count, b.count), sort.dir);
    default:
      return applyDir(byString(a.name, b.name), sort.dir);
  }
}

/**
 * The cookbooks list: a searchable, paginated table sortable by name, latest
 * version, or number of versions. Unlike the shared {@link ResourceTable} this
 * carries extra columns, so — like the members page — it is its own component.
 */
export function CookbooksTable({
  basePath,
  cookbooks,
}: {
  basePath: string;
  cookbooks: CookbookSummary[];
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const { sort, setSort } = useSort("sort", DEFAULT_SORT, SORT_KEYS);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return cookbooks
      .filter((c) => c.name.toLowerCase().includes(needle))
      .sort((a, b) => compareBy(a, b, sort));
  }, [cookbooks, q, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp during render so a shrinking filter can never strand us past the end.
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function onFilter(value: string) {
    setQ(value);
    setPage(0);
  }

  if (cookbooks.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Cookbooks" />
        <EmptyState
          illustration={<CookbooksIllustration />}
          title="No cookbooks yet"
          actions={
            <CommandSnippet
              commands={{
                cinc: ["cinc cookbook upload COOKBOOK"],
                knife: ["knife cookbook upload COOKBOOK"],
              }}
            />
          }
        >
          Cookbooks hold the recipes your nodes run. Upload them from your
          workstation; this page lists every version and lets you delete them.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Cookbooks" />

      <Input
        placeholder="Filter cookbooks…"
        value={q}
        onChange={(e) => onFilter(e.target.value)}
        className="max-w-xs"
      />

      <div className="overflow-hidden rounded-lg border border-border">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            No cookbooks matching &ldquo;{q}&rdquo;.
          </p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">
              Cookbooks, sortable by name, latest version, and version count
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <SortableTh label="Name" sortKey="name" sort={sort} onSort={setSort} />
                <SortableTh
                  label="Latest version"
                  sortKey="latest"
                  sort={sort}
                  onSort={setSort}
                />
                <SortableTh
                  label="Versions"
                  sortKey="count"
                  sort={sort}
                  onSort={setSort}
                />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.name}
                  className="border-b border-border last:border-0 hover:bg-surface-2"
                >
                  <td className="p-0">
                    <Link
                      href={`${basePath}/${encodeURIComponent(c.name)}`}
                      className="block px-4 py-2.5 font-mono text-sm text-text transition-colors hover:text-link"
                    >
                      <span className="truncate">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text">
                    {c.latest ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-text">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {filtered.length === 0
            ? `0 of ${cookbooks.length}`
            : `${start + 1}–${start + visible.length} of ${filtered.length}` +
              (filtered.length === cookbooks.length
                ? ""
                : ` (${cookbooks.length} total)`)}
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
