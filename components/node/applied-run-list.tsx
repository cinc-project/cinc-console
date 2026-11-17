import { cookbookOf, type NodeFacts } from "@/lib/cinc/node-facts";
import { EmptyState } from "@/components/details/primitives";
import { NodeSection } from "./parts";

/**
 * What the client actually applied on its last run — the roles and recipes it
 * wrote back to `automatic`, with the cookbook version each recipe resolved
 * to. Comparing this with the configured run list shows drift (a role edited
 * since, a version pin that moved).
 */
export function AppliedRunList({ facts }: { facts: NodeFacts }) {
  const { appliedRoles, appliedRecipes, cookbookVersions } = facts;
  const ran = appliedRoles.length > 0 || appliedRecipes.length > 0;

  return (
    <NodeSection
      title="Applied on last run"
      action={<span className="text-xs text-muted">Reported by the client</span>}
    >
      {!ran ? (
        <EmptyState>
          {facts.ohaiTime === null
            ? "The client hasn't run yet."
            : "No recipes ran on the last check-in."}
        </EmptyState>
      ) : (
        <div className="space-y-3 text-sm">
          {appliedRoles.length > 0 && (
            <p>
              <span className="text-muted">Roles: </span>
              <span className="font-mono">{appliedRoles.join(", ")}</span>
            </p>
          )}
          <ol className="divide-y divide-border rounded-md border border-border">
            {appliedRecipes.map((r, i) => {
              const version = cookbookVersions[cookbookOf(r)];
              return (
                <li key={`${r}-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
                  <span className="font-mono">{r}</span>
                  {version && (
                    <span className="font-mono text-xs text-muted">
                      {cookbookOf(r)} {version}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </NodeSection>
  );
}
