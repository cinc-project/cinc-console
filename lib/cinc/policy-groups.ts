import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";
import { escapeSearchTerm, partialSearch } from "./search";

/** One policy pinned in a group, at the revision nodes in that group run. */
export type PolicyPin = { policy: string; revision: string };
export type PolicyGroupSummary = { name: string; policies: PolicyPin[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * The pins in one group body, `{ policies: { "<policy>": { revision_id } } }`,
 * sorted by policy name. A group with no policies (or an empty "policies") is
 * a valid, empty group; a pin without a string revision_id is skipped.
 */
export function parsePolicyGroup(name: string, data: unknown): PolicyGroupSummary {
  const policies: PolicyPin[] = [];
  if (isRecord(data) && isRecord(data.policies)) {
    for (const [policy, pin] of Object.entries(data.policies)) {
      if (isRecord(pin) && typeof pin.revision_id === "string") {
        policies.push({ policy, revision: pin.revision_id });
      }
    }
  }
  policies.sort((a, b) => a.policy.localeCompare(b.policy));
  return { name, policies };
}

/** Every group in a `/policy_groups` payload (name → group body), by name. */
export function parsePolicyGroups(data: unknown): PolicyGroupSummary[] {
  if (!isRecord(data)) return [];
  return Object.entries(data)
    .map(([name, body]) => parsePolicyGroup(name, body))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The reverse view for one policy: revision id → the groups pinning it, so the
 * policy page can say which revision is live where. Pure, from one list call.
 */
export function groupsByRevision(
  groups: PolicyGroupSummary[],
  policy: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of groups) {
    for (const pin of g.policies) {
      if (pin.policy === policy) (out[pin.revision] ??= []).push(g.name);
    }
  }
  return out;
}

/** `GET /policy_groups`: every group with its pinned policies. */
export async function listPolicyGroups(
  user: string,
  org: string,
): Promise<PolicyGroupSummary[]> {
  const data = await cincRequest<unknown>({
    user,
    org,
    method: "GET",
    path: cincPath`/policy_groups`,
  });
  return parsePolicyGroups(data);
}

/** `GET /policy_groups/GROUP`: the raw group body (for the JSON view). */
export async function getPolicyGroup(
  user: string,
  org: string,
  group: string,
): Promise<unknown> {
  return cincRequest<unknown>({
    user,
    org,
    method: "GET",
    path: cincPath`/policy_groups/${group}`,
  });
}

/**
 * Unpin a policy from a group (`DELETE /policy_groups/GROUP/policies/POLICY`).
 * The policy and its revisions stay; nodes in the group lose their pin.
 */
export async function removePolicyFromGroup(
  user: string,
  org: string,
  group: string,
  policy: string,
): Promise<void> {
  await cincRequest({
    user,
    org,
    method: "DELETE",
    path: cincPath`/policy_groups/${group}/policies/${policy}`,
  });
}

/** Delete a whole group (`DELETE /policy_groups/GROUP`); policies are untouched. */
export async function deletePolicyGroup(
  user: string,
  org: string,
  group: string,
): Promise<void> {
  await cincRequest({
    user,
    org,
    method: "DELETE",
    path: cincPath`/policy_groups/${group}`,
  });
}

export type PolicyGroupNode = { name: string; policyName: string | null };

/**
 * Nodes whose `policy_group` is GROUP, via one partial search that returns only
 * their name and policy name.
 */
export async function listPolicyGroupNodes(
  user: string,
  org: string,
  group: string,
): Promise<PolicyGroupNode[]> {
  const rows = await partialSearch<{ name?: unknown; policy_name?: unknown }>(
    user,
    org,
    "node",
    { name: ["name"], policy_name: ["policy_name"] },
    `policy_group:${escapeSearchTerm(group)}`,
  );
  return rows
    .filter((r): r is { name: string; policy_name?: unknown } => typeof r.name === "string")
    .map((r) => ({
      name: r.name,
      policyName: typeof r.policy_name === "string" ? r.policy_name : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
