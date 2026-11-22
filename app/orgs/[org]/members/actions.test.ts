// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "alice" }));

const {
  invite,
  cancelInvite: cancelInviteFn,
  removeUser: removeUserFn,
  updateGroup,
  getGroup,
  deleteGroupFn,
} = vi.hoisted(() => ({
    invite: vi.fn(),
    cancelInvite: vi.fn(),
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
    cancelInvite: cancelInviteFn,
    removeUser: removeUserFn,
    updateGroup,
    getGroup,
    deleteGroup: deleteGroupFn,
  },
}));

import {
  inviteUser,
  cancelInvite,
  removeUser,
  saveGroup,
  deleteGroup,
} from "./actions";

beforeEach(() => {
  invite.mockReset();
  cancelInviteFn.mockReset();
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

test("cancelInvite withdraws the invitation by id", async () => {
  cancelInviteFn.mockResolvedValueOnce({});
  await expect(cancelInvite("acme", "carol-acme")).resolves.toEqual({ ok: true });
  expect(cancelInviteFn).toHaveBeenCalledWith("alice", "acme", "carol-acme");
});

describe("removeUser", () => {
  test("removes a plain member without touching admins", async () => {
    getGroup.mockResolvedValueOnce({ users: ["alice"], clients: [], groups: [] });
    removeUserFn.mockResolvedValueOnce({});
    await expect(removeUser("acme", "bob")).resolves.toEqual({ ok: true });
    expect(updateGroup).not.toHaveBeenCalled();
    expect(removeUserFn).toHaveBeenCalledWith("alice", "acme", "bob");
  });

  test("takes an admin out of admins first, since the server refuses otherwise", async () => {
    getGroup.mockResolvedValueOnce({ users: ["alice", "bob"], clients: [], groups: [] });
    updateGroup.mockResolvedValueOnce({});
    removeUserFn.mockResolvedValueOnce({});
    await expect(removeUser("acme", "bob")).resolves.toEqual({ ok: true });
    // Only the users kind is sent, so clients and nested groups are kept.
    expect(updateGroup).toHaveBeenCalledWith("alice", "acme", "admins", {
      groupname: "admins",
      actors: { users: ["alice"] },
    });
    expect(updateGroup.mock.invocationCallOrder[0]).toBeLessThan(
      removeUserFn.mock.invocationCallOrder[0],
    );
  });

  test("refuses to remove the org's last admin", async () => {
    getGroup.mockResolvedValueOnce({ users: ["bob"], clients: [], groups: [] });
    await expect(removeUser("acme", "bob")).resolves.toEqual({ error: "last admin" });
    expect(updateGroup).not.toHaveBeenCalled();
    expect(removeUserFn).not.toHaveBeenCalled();
  });

  test("still tries when admins can't be read, and lets the server decide", async () => {
    getGroup.mockRejectedValueOnce(new CincError(403, "denied"));
    removeUserFn.mockRejectedValueOnce(new CincError(403, "denied"));
    await expect(removeUser("acme", "bob")).resolves.toEqual({ error: "forbidden" });
  });

  test("explains an admin through a nested group instead of saying forbidden", async () => {
    getGroup.mockResolvedValueOnce({ users: ["alice"], clients: [], groups: ["ops"] });
    removeUserFn.mockRejectedValueOnce(
      new CincError(403, {
        error:
          "Please remove bob from this organization's admins group before removing him or her from the organization.",
      }),
    );
    await expect(removeUser("acme", "bob")).resolves.toEqual({ error: "nested admin" });
  });
});
