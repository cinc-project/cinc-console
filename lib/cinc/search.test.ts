// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { searchTotal } from "./search";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

test("searchTotal asks for zero rows and returns the total", async () => {
  req.mockResolvedValueOnce({ total: 42, start: 0, rows: [] });

  const total = await searchTotal("alice", "acme", "node", "ohai_time:[* TO *]");

  expect(total).toBe(42);
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "POST",
    path: cincPath`/search/node`,
    query: { q: "ohai_time:[* TO *]", rows: 0, start: 0 },
    body: {},
  });
});

test("searchTotal treats a missing total as zero", async () => {
  req.mockResolvedValueOnce({ rows: [] });
  expect(await searchTotal("alice", "acme", "node", "*:*")).toBe(0);
});
