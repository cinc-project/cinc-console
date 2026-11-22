"use server";

import { requireUser } from "@/lib/session";
import { makeResource } from "@/lib/cinc/resource";
import { policies, policyGroups } from "@/lib/cinc/readonly";

export type PaletteObject = { kind: string; label: string; name: string };

const KINDS = [
  { kind: "nodes", label: "Node" },
  { kind: "roles", label: "Role" },
  { kind: "environments", label: "Environment" },
];

/**
 * Names of the org's jump-to-able objects (nodes, roles, environments,
 * policies, policy groups) for the ⌘K palette. List endpoints return name→url
 * maps, so this is names only. Each type is fetched in parallel and a type the
 * user can't list is skipped rather than failing the whole search.
 */
export async function searchOrgObjects(org: string): Promise<PaletteObject[]> {
  const user = await requireUser();
  const out: PaletteObject[] = [];

  const collect = async (kind: string, label: string, list: () => Promise<Record<string, unknown>>) => {
    try {
      const res = await list();
      for (const name of Object.keys(res)) out.push({ kind, label, name });
    } catch {
      // No access to this type (403) or it's unavailable — skip it.
    }
  };

  await Promise.all([
    ...KINDS.map((k) =>
      collect(k.kind, k.label, () => makeResource(k.kind).list(user, org)),
    ),
    collect("policies", "Policy", () => policies.list(user, org)),
    collect("policy_groups", "Policy group", () => policyGroups.list(user, org)),
  ]);

  return out;
}
