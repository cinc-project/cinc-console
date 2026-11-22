// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { members, groupUpdateBody, missingMembers } from "./members";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

test("listUsers hits GET /users within the org", async () => {
  req.mockResolvedValueOnce([]);
  await members.listUsers("alice", "acme");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/users`,
  });
});

test("invite POSTs the username to /association_requests", async () => {
  req.mockResolvedValueOnce({});
  await members.invite("alice", "acme", "bob");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "POST",
    path: cincPath`/association_requests`,
    body: { user: "bob" },
  });
});

test("removeUser DELETEs /users/<name>", async () => {
  req.mockResolvedValueOnce({});
  await members.removeUser("alice", "acme", "bob");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "DELETE",
    path: cincPath`/users/bob`,
  });
});

test("getGroup hits GET /groups/<name>", async () => {
  req.mockResolvedValueOnce({});
  await members.getGroup("alice", "acme", "admins");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/groups/admins`,
  });
});

test("updateGroup PUTs the body to /groups/<name>", async () => {
  req.mockResolvedValueOnce({});
  await members.updateGroup("alice", "acme", "admins", { users: ["bob"] });
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "PUT",
    path: cincPath`/groups/admins`,
    body: { users: ["bob"] },
  });
});

describe("groupUpdateBody", () => {
  test("turns the GET shape's top-level lists into Chef's nested actors", () => {
    // A GET returns actors as a flat array plus top-level lists; erchef reads
    // only the nested object on PUT, so the top-level lists must move into it.
    const body = groupUpdateBody("admins", {
      actors: ["web01", "bob"],
      users: ["bob"],
      clients: ["web01"],
      groups: [],
      orgname: "acme",
      name: "admins",
      groupname: "admins",
    });
    expect(body).toEqual({
      groupname: "admins",
      actors: { users: ["bob"], clients: ["web01"], groups: [] },
    });
  });

  test("passes an already-nested actors object through", () => {
    expect(
      groupUpdateBody("ops", { actors: { users: ["a"], clients: ["c"], groups: ["g"] } }),
    ).toEqual({
      groupname: "ops",
      actors: { users: ["a"], clients: ["c"], groups: ["g"] },
    });
  });

  test("omits a kind the body doesn't give, so the server keeps its members", () => {
    expect(groupUpdateBody("ops", { clients: ["c"] })).toEqual({
      groupname: "ops",
      actors: { clients: ["c"] },
    });
  });

  test("names the group from the path, never the body", () => {
    expect(groupUpdateBody("ops", { groupname: "admins", users: [] })).toEqual({
      groupname: "ops",
      actors: { users: [] },
    });
  });

  test("drops non-string entries and fields it doesn't know", () => {
    expect(
      groupUpdateBody("ops", { users: ["a", 5, null, "b"], acl: { x: 1 } }),
    ).toEqual({ groupname: "ops", actors: { users: ["a", "b"] } });
  });
});

describe("missingMembers", () => {
  test("lists requested names the saved group doesn't contain", () => {
    expect(
      missingMembers(
        { users: ["bob", "typo"], clients: ["web01"] },
        { users: ["bob"], clients: ["web01"], groups: [] },
      ),
    ).toEqual(["typo"]);
  });

  test("is empty when everything was saved", () => {
    expect(missingMembers({ groups: ["g"] }, { groups: ["g"] })).toEqual([]);
  });
});

test("listInvites hits GET /association_requests within the org", async () => {
  req.mockResolvedValueOnce([]);
  await members.listInvites("alice", "acme");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/association_requests`,
  });
});

test("cancelInvite DELETEs /association_requests/<id>", async () => {
  req.mockResolvedValueOnce({});
  await members.cancelInvite("alice", "acme", "bob-acme");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "DELETE",
    path: cincPath`/association_requests/bob-acme`,
  });
});
