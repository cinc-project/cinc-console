import "server-only";
import { cincRequest } from "./client";
import { cincPath } from "./path";
import type { FleetNode } from "./fleet";

/**
 * Chef partial search. POST /search/<index> with a body mapping each result key
 * to a path into the (deep-merged) node document; the server returns only those
 * fields per row instead of the whole multi-KB object. This is how a dashboard
 * reads thousands of nodes cheaply — the alternative (GET /nodes then GET each)
 * is N+1 and pulls everything.
 *
 * The query (`q`, `rows`, `start`) goes through `query`, NOT `path`, because the
 * query string is not part of Chef's signed canonical path (see client.ts).
 */
type SearchRow<T> = { url?: string; data?: T };
type SearchResponse<T> = { total: number; start: number; rows: SearchRow<T>[] };

const PAGE_ROWS = 1000;
/** Safety cap so a huge org can't spin forever; 50 pages = 50k nodes. */
const MAX_PAGES = 50;

export async function partialSearch<T>(
  user: string,
  org: string,
  index: string,
  keys: Record<string, string[]>,
  query = "*:*",
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await cincRequest<SearchResponse<T>>({
      user,
      org,
      method: "POST",
      path: cincPath`/search/${index}`,
      query: { q: query, rows: PAGE_ROWS, start: page * PAGE_ROWS },
      body: keys,
    });
    for (const row of res.rows ?? []) {
      // Partial search wraps each hit in { url, data }; tolerate a server that
      // returns the bare object instead.
      const data = (row.data ?? (row as unknown)) as T;
      out.push(data);
    }
    if (out.length >= (res.total ?? out.length) || (res.rows ?? []).length === 0) {
      break;
    }
  }
  return out;
}

/**
 * Count-only search: POST with `rows: 0` so Solr returns just the `total` for
 * the query and retrieves no documents. This is how the dashboard's leading
 * tiles get a fast number under load — the count is cheap even when the full
 * field-by-field sweep (partialSearch) is slow.
 */
export async function searchTotal(
  user: string,
  org: string,
  index: string,
  query: string,
): Promise<number> {
  const res = await cincRequest<SearchResponse<unknown>>({
    user,
    org,
    method: "POST",
    path: cincPath`/search/${index}`,
    query: { q: query, rows: 0, start: 0 },
    body: {},
  });
  return res.total ?? 0;
}

/** The exact node fields the dashboard's stat logic needs. */
const FLEET_KEYS: Record<string, string[]> = {
  name: ["name"],
  ohai_time: ["ohai_time"],
  run_list: ["run_list"],
  policy_name: ["policy_name"],
  policy_group: ["policy_group"],
  chef_version: ["chef_packages", "chef", "version"],
};

type RawFleetRow = {
  name?: unknown;
  ohai_time?: unknown;
  run_list?: unknown;
  policy_name?: unknown;
  policy_group?: unknown;
  chef_version?: unknown;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Parse one partial-search row into a FleetNode, tolerating missing fields. */
export function parseFleetRow(row: RawFleetRow): FleetNode {
  return {
    name: asString(row.name) ?? "(unnamed)",
    ohaiTime: typeof row.ohai_time === "number" ? row.ohai_time : null,
    runList: asStringList(row.run_list),
    policyName: asString(row.policy_name),
    policyGroup: asString(row.policy_group),
    chefVersion: asString(row.chef_version),
  };
}

/** Fetch every node in the org as a FleetNode via one partial search sweep. */
export async function fetchFleetNodes(
  user: string,
  org: string,
): Promise<FleetNode[]> {
  const rows = await partialSearch<RawFleetRow>(user, org, "node", FLEET_KEYS);
  return rows.map(parseFleetRow);
}
