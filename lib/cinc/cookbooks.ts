import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";
import { compareVersions } from "./fleet";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** One row of the cookbooks list: its name, newest version, and how many exist. */
export type CookbookSummary = {
  name: string;
  /** Highest version present, or null when the cookbook has no versions. */
  latest: string | null;
  count: number;
};

/** Version strings from one `{ url, versions: [{ version }, …] }` entry. */
function versionsOf(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.versions)) return [];
  return value.versions
    .map((v) => (isRecord(v) && typeof v.version === "string" ? v.version : null))
    .filter((v): v is string => v !== null);
}

/**
 * Summarize a `/cookbooks?num_versions=all` payload — `{ NAME: { versions: […] } }`
 * — into one row per cookbook. Pure (no request) and order-independent: `latest`
 * is the highest version by {@link compareVersions}, not whatever the server
 * listed first. The default `/cookbooks` (latest only) yields a count of 1.
 */
export function parseCookbookList(data: unknown): CookbookSummary[] {
  if (!isRecord(data)) return [];
  return Object.entries(data).map(([name, value]) => {
    const versions = versionsOf(value);
    const latest = versions.reduce<string | null>(
      (best, v) => (best === null || compareVersions(v, best) > 0 ? v : best),
      null,
    );
    return { name, latest, count: versions.length };
  });
}

/**
 * Pull version strings out of a `/cookbooks/NAME` payload, which nests them as
 * `{ NAME: { versions: [{ version, url }, …] } }`. Pure — no request — so a page
 * that already fetched the cookbook can reuse it.
 */
export function parseCookbookVersions(data: unknown): string[] {
  if (!isRecord(data)) return [];
  for (const value of Object.values(data)) {
    if (isRecord(value) && Array.isArray(value.versions)) {
      return versionsOf(value);
    }
  }
  return [];
}

/**
 * Summaries for every cookbook in the org (`GET /cookbooks?num_versions=all`).
 * The `num_versions=all` query is what makes the version count meaningful — the
 * default response carries only each cookbook's latest version. The query lives
 * in `query`, never in `path`, so it stays out of the signed canonical path.
 */
export async function listCookbooks(
  user: string,
  org: string,
): Promise<CookbookSummary[]> {
  const data = await cincRequest<Record<string, unknown>>({
    user,
    org,
    method: "GET",
    path: cincPath`/cookbooks`,
    query: { num_versions: "all" },
  });
  return parseCookbookList(data);
}

/** Version strings for a cookbook (`GET /cookbooks/NAME`). */
export async function listCookbookVersions(
  user: string,
  org: string,
  name: string,
): Promise<string[]> {
  const data = await cincRequest<Record<string, unknown>>({
    user,
    org,
    method: "GET",
    path: cincPath`/cookbooks/${name}`,
  });
  return parseCookbookVersions(data);
}

/** Delete a single cookbook version (`DELETE /cookbooks/NAME/VERSION`). */
export async function deleteCookbookVersion(
  user: string,
  org: string,
  name: string,
  version: string,
): Promise<void> {
  await cincRequest({
    user,
    org,
    method: "DELETE",
    path: cincPath`/cookbooks/${name}/${version}`,
  });
}

/**
 * Delete an entire cookbook. Chef has no whole-cookbook delete; remove every
 * version. Sequential so a mid-way ACL/transport failure surfaces clearly
 * rather than firing a burst of partially-applied deletes.
 */
export async function deleteCookbook(
  user: string,
  org: string,
  name: string,
): Promise<void> {
  const versions = await listCookbookVersions(user, org, name);
  for (const version of versions) {
    await deleteCookbookVersion(user, org, name, version);
  }
}
