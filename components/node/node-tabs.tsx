"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

/** Tab slug (child route segment) -> label. Overview is the index route. */
export const NODE_TABS = [
  { segment: null, label: "Overview" },
  { segment: "run-list", label: "Run list & tags" },
  { segment: "hardware", label: "Hardware" },
  { segment: "attributes", label: "Attributes" },
  { segment: "json", label: "Raw JSON" },
] as const;

/**
 * The node's section tabs. Each tab is its own route, so this is a nav of
 * links (bookmarkable, Back works) marked with aria-current — not an ARIA
 * tablist, which implies in-page panels.
 */
export function NodeTabs({ base }: { base: string }) {
  const active = useSelectedLayoutSegment();
  return (
    <nav aria-label="Node sections" className="flex gap-1 overflow-x-auto border-b border-border">
      {NODE_TABS.map((t) => {
        const current = t.segment === active;
        return (
          <Link
            key={t.label}
            href={t.segment ? `${base}/${t.segment}` : base}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-11 items-center whitespace-nowrap border-b-2 px-4 text-sm transition-colors",
              current
                ? "border-link font-medium text-text"
                : "border-transparent text-muted hover:text-text",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
