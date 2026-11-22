// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "alice" }));

const { invite, removeUser: removeUserFn, updateGroup, getGroup, deleteGroupFn } =
  vi.hoisted(() => ({
    invite: vi.fn(),
    removeUser: vi.fn(),
    updateGroup: vi.fn(),
    getGroup: vi.fn(),
    deleteGroupFn: vi.fn(),
  }));
// Keep the pure helpers (groupUpdateBody, missingMembers) real; mock only the
// server calls.
vi.mock("@/lib/cinc/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cinc/members")>()),
  members: {
    invite,
    removeUser: removeUserFn,
    updateGroup,
    getGroup,
    deleteGroup: deleteGroupFn,
  },
}));

import { inviteUser, removeUser, saveGroup, deleteGroup } from "./actions";

beforeEach(() => {
  invite.mockReset();
  removeUserFn.mockReset();
  updateGroup.mockReset();
  getGroup.mockReset();
  deleteGroupFn.mockReset();
});

test("inviteUser invites by username", async () => {
  invite.mockResolvedValueOnce({});
  await expect(inviteUser("acme", "bob")).resolves.toEqual({ ok: true });
  expect(invite).toHaveBeenCalledWith("alice", "acme", "bob");
});

test("removeUser translates 403 into a forbidden result", async () => {
  removeUserFn.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(removeUser("acme", "bob")).resolves.toEqual({
    error: "forbidden",
  });
});

test("saveGroup rejects invalid JSON without calling the server", async () => {
  await expect(saveGroup("acme", "admins", "{not json")).resolves.toEqual({
    error: "invalid JSON",
  });
  expect(updateGroup).not.toHaveBeenCalled();
});

test("saveGroup sends members nested under actors, as erchef reads them", async () => {
  updateGroup.mockResolvedValueOnce({});
  getGroup.mockResolvedValueOnce({ users: ["bob"], clients: [], groups: [] });
  await expect(
    saveGroup(
      "acme",
      "admins",
      '{"actors":["bob"],"users":["bob"],"clients":[],"groups":[],"orgname":"acme"}',
    ),
  ).resolves.toEqual({ ok: true });
  expect(updateGroup).toHaveBeenCalledWith("alice", "acme", "admins", {
    groupname: "admins",
    actors: { users: ["bob"], clients: [], groups: [] },
  });
});

test("saveGroup reports names the server silently dropped", async () => {
  // erchef drops members it can't resolve and still answers 200.
  updateGroup.mockResolvedValueOnce({});
  getGroup.mockResolvedValueOnce({ users: ["bob"], clients: [], groups: [] });
  await expect(
    saveGroup("acme", "users", '{"users":["bob"],"clients":["managment-agent"]}'),
  ).resolves.toEqual({
    error:
      "Saved, but the server didn't add managment-agent. Check that a user, client, or group by that name exists.",
  });
});

test("deleteGroup removes the group by name", async () => {
  deleteGroupFn.mockResolvedValueOnce({});
  await expect(deleteGroup("acme", "admins")).resolves.toEqual({ ok: true });
  expect(deleteGroupFn).toHaveBeenCalledWith("alice", "acme", "admins");
});

test("deleteGroup translates 403 into a forbidden result", async () => {
  deleteGroupFn.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(deleteGroup("acme", "admins")).resolves.toEqual({
    error: "forbidden",
  });
});
