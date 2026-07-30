// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { members } from "./members";
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
