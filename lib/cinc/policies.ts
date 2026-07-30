import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Revision ids from a `/policies/NAME` payload, which shapes them as
 * `{ revisions: { "1.0.0": {…} } }`. Pure — no request — so a page that already
 * fetched the policy can reuse it.
 */
export function parsePolicyRevisions(data: unknown): string[] {
  if (isRecord(data) && isRecord(data.revisions)) {
    return Object.keys(data.revisions);
  }
  return [];
}

/** Revision ids for a policy (`GET /policies/NAME`). */
export async function listPolicyRevisions(
  user: string,
  org: string,
  name: string,
): Promise<string[]> {
  const data = await cincRequest<Record<string, unknown>>({
    user,
    org,
    method: "GET",
    path: cincPath`/policies/${name}`,
  });
  return parsePolicyRevisions(data);
}

/** Delete a single policy revision (`DELETE /policies/NAME/revisions/REV`). */
export async function deletePolicyRevision(
  user: string,
  org: string,
  name: string,
  revision: string,
): Promise<void> {
  await cincRequest({
    user,
    org,
    method: "DELETE",
    path: cincPath`/policies/${name}/revisions/${revision}`,
  });
}

/**
 * Delete an entire policy. Like cookbooks, Chef has no whole-policy delete;
 * remove every revision sequentially so a mid-way failure surfaces clearly.
 */
export async function deletePolicy(
  user: string,
  org: string,
  name: string,
): Promise<void> {
  const revisions = await listPolicyRevisions(user, org, name);
  for (const revision of revisions) {
    await deletePolicyRevision(user, org, name, revision);
  }
}
