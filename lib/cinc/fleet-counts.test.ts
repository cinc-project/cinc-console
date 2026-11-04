// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const searchTotal = vi.fn();
vi.mock("./search", () => ({ searchTotal: (...a: unknown[]) => searchTotal(...a) }));

import { fetchFleetCounts } from "./fleet-counts";
import { MISSING_AFTER_MS, RECENT_WITHIN_MS } from "./fleet";

const NOW = 1_700_000_000_000; // fixed "now" in ms

beforeEach(() => searchTotal.mockReset());

test("derives recent, missing and unconfigured from cheap totals", async () => {
  // total 10, within 12h 7 -> missing 3 ; configured 8 -> unconfigured 2
  searchTotal
    .mockResolvedValueOnce(10) // *:*
    .mockResolvedValueOnce(7) // checked in within 12h
    .mockResolvedValueOnce(8) // configured
    .mockResolvedValueOnce(5); // checked in within the hour

  expect(await fetchFleetCounts("alice", "acme", NOW)).toEqual({
    recent: 5,
    missing: 3,
    unconfigured: 2,
  });

  const cutoff = Math.floor((NOW - MISSING_AFTER_MS) / 1000);
  expect(searchTotal).toHaveBeenCalledWith("alice", "acme", "node", "*:*");
  expect(searchTotal).toHaveBeenCalledWith(
    "alice",
    "acme",
    "node",
    `ohai_time:{${cutoff} TO *}`,
  );
  expect(searchTotal).toHaveBeenCalledWith(
    "alice",
    "acme",
    "node",
    `policy_name:[* TO *] OR (run_list:[* TO *] AND NOT chef_environment:_default)`,
  );
  const hourAgo = Math.floor((NOW - RECENT_WITHIN_MS) / 1000);
  expect(searchTotal).toHaveBeenCalledWith(
    "alice",
    "acme",
    "node",
    `ohai_time:[${hourAgo} TO *]`,
  );
});

test("never reports negative counts", async () => {
  // Complement counts exceeding the total (e.g. a racing index) must clamp to 0,
  // not surface a negative tile.
  searchTotal
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(8)
    .mockResolvedValueOnce(9)
    .mockResolvedValueOnce(2);

  expect(await fetchFleetCounts("alice", "acme", NOW)).toEqual({
    recent: 2,
    missing: 0,
    unconfigured: 0,
  });
});

test("degrades to null counts when a search fails", async () => {
  // One failing query is enough to abandon the cheap-count path; the others
  // resolve so we don't leave stray rejected promises around.
  searchTotal.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(0);

  expect(await fetchFleetCounts("alice", "acme", NOW)).toEqual({
    recent: null,
    missing: null,
    unconfigured: null,
  });
});
