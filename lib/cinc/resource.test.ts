// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { makeResource } from "./resource";
import { cincPath } from "./path";

const nodes = makeResource("nodes");

beforeEach(() => req.mockReset());

test("list hits GET /<kind> within the org", async () => {
  req.mockResolvedValueOnce({ web01: "https://s/.../web01" });
  await nodes.list("alice", "acme");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/nodes`,
  });
});

test("get hits GET /<kind>/<name>", async () => {
  req.mockResolvedValueOnce({});
  await nodes.get("alice", "acme", "web01");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/nodes/web01`,
  });
});

test("update hits PUT /<kind>/<name> with body", async () => {
  req.mockResolvedValueOnce({});
  await nodes.update("alice", "acme", "web01", { name: "web01" });
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "PUT",
    path: cincPath`/nodes/web01`,
    body: { name: "web01" },
  });
});

test("remove hits DELETE /<kind>/<name>", async () => {
  req.mockResolvedValueOnce({});
  await nodes.remove("alice", "acme", "web01");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "DELETE",
    path: cincPath`/nodes/web01`,
  });
});
