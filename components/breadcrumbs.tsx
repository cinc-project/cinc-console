"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";

type Crumb = { label: string; href: string; link: boolean };

// Node detail tabs are child routes (/nodes/<name>/hardware); show their tab
// label rather than the raw slug.
const NODE_TAB_LABELS: Record<string, string> = {
  "run-list": "Run list & tags",
  hardware: "Hardware",
  attributes: "Attributes",
  json: "Raw JSON",
};

/**
 * Path-derived breadcrumb for org pages, e.g. `acme / Data Bags / secrets /
 * api_key`. The org and section/object segments link to their pages; segments
 * with no page of their own ("groups" and "users" under members, the kind
 * under permissions) are shown as plain text. The last crumb is the current page. Nothing renders on
 * the org home or outside /orgs.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "orgs" || parts.length < 3) return null; // need org + at least a section

  const org = parts[1];
  const rest = parts.slice(2);

  const crumbs: Crumb[] = [
    { label: decodeURIComponent(org), href: `/orgs/${org}`, link: true },
  ];
  let acc = `/orgs/${org}`;
  rest.forEach((seg, i) => {
    acc += `/${seg}`;
    const isSection = i === 0;
    const nodeTab = rest[0] === "nodes" && i === 2 ? NODE_TAB_LABELS[seg] : undefined;
    const label = isSection
      ? (NAV.find((n) => n.slug === seg)?.label ?? decodeURIComponent(seg))
      : (nodeTab ?? decodeURIComponent(seg));
    // Path segments with no page of their own: "groups" and "users" under
    // /members, and the object kind under /permissions (…/permissions/nodes/web01).
    const structural =
      (i === 1 && rest[0] === "members" && (seg === "groups" || seg === "users")) ||
      (i === 1 && rest[0] === "permissions" && seg !== "organization" && rest.length > 2);
    crumbs.push({ label, href: acc, link: !structural });
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-border">
                  /
                </span>
              )}
              {last ? (
                <span aria-current="page" className="text-text">
                  {c.label}
                </span>
              ) : c.link ? (
                <Link href={c.href} className="hover:text-link">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
