// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { cookbooks, clients } from "./readonly";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

test("cookbooks.list hits GET /cookbooks within the org", async () => {
  req.mockResolvedValueOnce({ nginx: {} });
  await cookbooks.list("alice", "acme");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/cookbooks`,
  });
});

test("clients.get hits GET /clients/<name>", async () => {
  req.mockResolvedValueOnce({});
  await clients.get("alice", "acme", "web01");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/clients/web01`,
  });
});
