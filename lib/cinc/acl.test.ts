// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { getAcl, setPermission, listContainers, normalizeAcl } from "./acl";
import { cincPath } from "./path";

beforeEach(() => {
  req.mockReset();
});

test("getAcl reads an object's ACL within the org", async () => {
  req.mockResolvedValueOnce({});
  await getAcl("alice", "acme", { kind: "nodes", name: "web01" });
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/nodes/web01/_acl`,
  });
});

test("a container's ACL is at /containers/<name>/_acl", async () => {
  req.mockResolvedValueOnce({});
  await getAcl("alice", "acme", { kind: "containers", name: "policies" });
  expect(req.mock.calls[0][0]).toMatchObject({ org: "acme", path: cincPath`/containers/policies/_acl` });
});

test("the org's own ACL is at /organizations/<org>/organizations/_acl", async () => {
  req.mockResolvedValueOnce({});
  await getAcl("alice", "acme", { kind: "organization" });
  expect(req.mock.calls[0][0]).toMatchObject({ org: "acme", path: cincPath`/organizations/_acl` });
});

test("a user's ACL is global", async () => {
  req.mockResolvedValueOnce({});
  await getAcl("alice", "acme", { kind: "users", name: "bob" });
  expect(req.mock.calls[0][0]).toMatchObject({ org: undefined, path: cincPath`/users/bob/_acl` });
});

test("normalizeAcl fills every permission and drops junk", () => {
  expect(normalizeAcl({ read: { actors: ["bob", 3], groups: ["users"] }, bogus: {} })).toEqual({
    create: { actors: [], groups: [] },
    read: { actors: ["bob"], groups: ["users"] },
    update: { actors: [], groups: [] },
    delete: { actors: [], groups: [] },
    grant: { actors: [], groups: [] },
  });
});

test("setPermission PUTs one permission", async () => {
  req.mockResolvedValueOnce({});
  await setPermission("alice", "acme", { kind: "containers", name: "nodes" }, "create", {
    actors: ["ci"],
    groups: ["admins", "ops"],
  });
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "PUT",
    path: cincPath`/containers/nodes/_acl/create`,
    body: { create: { actors: ["ci"], groups: ["admins", "ops"] } },
  });
});

test("listContainers returns the sorted names", async () => {
  req.mockResolvedValueOnce({ roles: "u", nodes: "u" });
  await expect(listContainers("alice", "acme")).resolves.toEqual(["nodes", "roles"]);
});
