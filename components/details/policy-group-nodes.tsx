import Link from "next/link";
import { DetailSection, EmptyState } from "./primitives";
import type { PolicyGroupNode } from "@/lib/cinc/policy-groups";

/** Bounds the DOM; the count above the list is always the full total. */
const MAX_SHOWN = 50;

/**
 * Nodes whose policy_group is this group, from a search. `error` is the read
 * explanation when the search failed or was forbidden; the rest of the page
 * still renders.
 */
export function PolicyGroupNodes({
  org,
  nodes,
  error,
}: {
  org: string;
  nodes: PolicyGroupNode[];
  error?: string;
}) {
  const shown = nodes.slice(0, MAX_SHOWN);
  return (
    <DetailSection title="Nodes">
      {error ? (
        <p className="text-sm text-muted">{error}</p>
      ) : nodes.length === 0 ? (
        <EmptyState>No nodes are in this group.</EmptyState>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {nodes.length} node{nodes.length === 1 ? "" : "s"}
            {nodes.length > shown.length && `, showing the first ${shown.length}`}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {shown.map((n) => (
              <li
                key={n.name}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-1.5 text-sm"
              >
                <Link
                  href={`/orgs/${org}/nodes/${encodeURIComponent(n.name)}`}
                  className="font-mono text-text hover:text-link"
                >
                  {n.name}
                </Link>
                {n.policyName && (
                  <span className="font-mono text-muted">
                    <span className="sr-only">policy </span>
                    {n.policyName}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </DetailSection>
  );
}
