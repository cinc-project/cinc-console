// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { getAcl } from "./acl";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

test("getAcl hits GET /<kind>/<name>/_acl within the org", async () => {
  req.mockResolvedValueOnce({});
  await getAcl("alice", "acme", "nodes", "web01");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/nodes/web01/_acl`,
  });
});
