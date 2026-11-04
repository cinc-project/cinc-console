import "server-only";
import { searchTotal } from "./search";
import { MISSING_AFTER_MS, RECENT_WITHIN_MS } from "./fleet";

/**
 * The stat counts that can be answered by a cheap `rows=0` search, used to
 * paint the dashboard's leading tiles fast while the full fleet sweep (which
 * feeds the node list and the Outdated tile) is still loading. `null` means the
 * count couldn't be determined — the tile then shows a placeholder rather than a
 * wrong number, and the authoritative figure arrives with the sweep moments
 * later.
 */
export type FleetCounts = {
  recent: number | null;
  missing: number | null;
  unconfigured: number | null;
};

const UNAVAILABLE: FleetCounts = { recent: null, missing: null, unconfigured: null };

/**
 * Derive the Recent, Missing and Unconfigured counts from four cheap count
 * queries instead of the full field-by-field sweep. Recent is a direct range
 * query; the other two count the *complements* (Chef/Solr handles a top-level
 * pure negation far less reliably than a positive query) and subtract:
 *
 *   recent       = checked in within RECENT_WITHIN_MS
 *   missing      = total − (checked in within MISSING_AFTER_MS)
 *   unconfigured = total − (has a policy OR (has a run_list AND not in _default))
 *
 * These mirror `isRecent` / `isMissing` / `isUnconfigured` in fleet.ts: a node
 * that has never checked in is absent from both ranges, and a policyfile node
 * has a `policy_name` (so counted configured even in `_default`). The NOT is
 * nested under an AND, which Solr and cinc-server-ng both evaluate. Boundary rounding
 * on the cutoff is immaterial — this is a fast first-paint estimate that the
 * authoritative sweep supersedes.
 *
 * Any failure degrades the whole thing to "unavailable" rather than throwing, so
 * the caller can hand this straight to a Suspense boundary as a never-rejecting
 * promise.
 */
export async function fetchFleetCounts(
  user: string,
  org: string,
  nowMs: number,
): Promise<FleetCounts> {
  const cutoff = Math.floor((nowMs - MISSING_AFTER_MS) / 1000);
  try {
    const hourAgo = Math.floor((nowMs - RECENT_WITHIN_MS) / 1000);
    const [total, present, configured, recent] = await Promise.all([
      searchTotal(user, org, "node", "*:*"),
      // Strict lower bound ({) so "exactly at the cutoff" counts as missing,
      // matching isMissing's `> threshold`. Keep both brackets matched ({…})
      // — real Cinc/Solr tolerates a mixed `{… ]`, but a leaner server (e.g.
      // cinc-server-ng) rejects it as an "unterminated range".
      searchTotal(user, org, "node", `ohai_time:{${cutoff} TO *}`),
      searchTotal(
        user,
        org,
        "node",
        `policy_name:[* TO *] OR (run_list:[* TO *] AND NOT chef_environment:_default)`,
      ),
      // Inclusive ([…]) to match isRecent's `<=`.
      searchTotal(user, org, "node", `ohai_time:[${hourAgo} TO *]`),
    ]);
    return {
      recent,
      missing: Math.max(0, total - present),
      unconfigured: Math.max(0, total - configured),
    };
  } catch {
    return UNAVAILABLE;
  }
}
