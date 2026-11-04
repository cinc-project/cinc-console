"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "@/lib/nav";

/** Shared styling for a nav link; `active` gets the current-page treatment. */
function navLinkClass(active: boolean): string {
  return cn(
    "block whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
    active
      ? "bg-primary/15 text-link font-medium"
      : "text-muted hover:bg-surface-2 hover:text-text",
  );
}

/**
 * The org's section links — one list rendered by both the desktop sidebar and
 * the phone drawer, so the two can't drift apart.
 */
export function PrimaryNavLinks({ org }: { org: string }) {
  const pathname = usePathname();
  const base = `/orgs/${org}`;
  return (
    <ul className="space-y-1">
      {/* Dashboard is the org root, not an object section, so it lives outside
          NAV and matches its path exactly — every sub-page's path starts with
          `base`, so startsWith would keep it always active. */}
      <li>
        <Link
          href={base}
          aria-current={pathname === base ? "page" : undefined}
          className={navLinkClass(pathname === base)}
        >
          Dashboard
        </Link>
      </li>
      {NAV.map((item) => {
        const href = `${base}/${item.slug}`;
        const active = pathname.startsWith(href);
        return (
          <li key={item.slug}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={navLinkClass(active)}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
