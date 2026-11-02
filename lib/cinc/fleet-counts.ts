import "server-only";
import { searchTotal } from "./search";
import { MISSING_AFTER_MS } from "./fleet";

/**
 * The two stat counts that can be answered by a cheap `rows=0` search, used to
 * paint the dashboard's leading tiles fast while the full fleet sweep (which
 * feeds the node list and the Outdated tile) is still loading. `null` means the
 * count couldn't be determined — the tile then shows a placeholder rather than a
 * wrong number, and the authoritative figure arrives with the sweep moments
 * later.
 */
export type FleetCounts = { missing: number | null; unconfigured: number | null };

const UNAVAILABLE: FleetCounts = { missing: null, unconfigured: null };

/**
 * Derive the Missing and Unconfigured counts from three cheap count queries
 * instead of the full field-by-field sweep. We count the *complements* with
 * positive queries (Chef/Solr handles those far more reliably than pure
 * negations) and subtract from the total:
 *
 *   missing      = total − (checked in within MISSING_AFTER_MS)
 *   unconfigured = total − (has a run_list OR a policy)
 *
 * These mirror `isMissing` / `isUnconfigured` in fleet.ts: a node that has
 * never checked in is absent from the "recent" set (so counted missing), and a
 * policyfile node has a `policy_name` (so counted configured). Boundary rounding
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
    const [total, recent, configured] = await Promise.all([
      searchTotal(user, org, "node", "*:*"),
      // Strict lower bound ({) so "exactly at the cutoff" counts as missing,
      // matching isMissing's `> threshold`. Keep both brackets matched ({…})
      // — real Cinc/Solr tolerates a mixed `{… ]`, but a leaner server (e.g.
      // cinc-server-ng) rejects it as an "unterminated range".
      searchTotal(user, org, "node", `ohai_time:{${cutoff} TO *}`),
      searchTotal(user, org, "node", `run_list:[* TO *] OR policy_name:[* TO *]`),
    ]);
    return {
      missing: Math.max(0, total - recent),
      unconfigured: Math.max(0, total - configured),
    };
  } catch {
    return UNAVAILABLE;
  }
}
