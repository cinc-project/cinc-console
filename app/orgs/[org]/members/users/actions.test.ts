// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "sam" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const config = vi.hoisted(() => ({ authMode: "local" }));
vi.mock("@/lib/config", () => ({ getConfig: () => config }));

const { users, members } = vi.hoisted(() => ({
  users: { get: vi.fn(), put: vi.fn(), create: vi.fn(), remove: vi.fn(), addMember: vi.fn() },
  members: { invite: vi.fn(), getGroup: vi.fn(), updateGroup: vi.fn() },
}));
vi.mock("@/lib/cinc/users", () => ({ users }));
vi.mock("@/lib/cinc/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cinc/members")>()),
  members,
}));

import { createUser, saveUserProfile, setUserPassword, setAdmin, deleteUser } from "./actions";

const NEW = {
  username: "dave",
  display_name: "Dave",
  email: "dave@example.com",
  password: "secret1",
  addToOrg: true,
};

beforeEach(() => {
  for (const f of [...Object.values(users), ...Object.values(members)]) f.mockReset();
  config.authMode = "local";
});

describe("createUser", () => {
  test("creates the user, adds them to the org, and returns the key once", async () => {
    users.create.mockResolvedValueOnce({ privateKey: "SECRET" });
    users.addMember.mockResolvedValueOnce({});
    await expect(createUser("acme", NEW)).resolves.toEqual({
      ok: true,
      privateKey: "SECRET",
      membership: "added",
    });
    expect(users.create).toHaveBeenCalledWith(
      "sam",
      { username: "dave", display_name: "Dave", email: "dave@example.com", password: "secret1" },
      undefined,
    );
    expect(users.addMember).toHaveBeenCalledWith("sam", "acme", "dave");
  });

  test("invites instead when adding directly is refused (only the superuser may)", async () => {
    users.create.mockResolvedValueOnce({ privateKey: undefined });
    users.addMember.mockRejectedValueOnce(new CincError(403, "denied"));
    members.invite.mockResolvedValueOnce({});
    await expect(createUser("acme", { ...NEW, publicKey: "PEM" })).resolves.toEqual({
      ok: true,
      membership: "invited",
    });
    expect(members.invite).toHaveBeenCalledWith("sam", "acme", "dave");
  });

  test("leaves membership alone when not asked", async () => {
    users.create.mockResolvedValueOnce({ privateKey: "K" });
    await expect(createUser("acme", { ...NEW, addToOrg: false })).resolves.toMatchObject({
      membership: "none",
    });
    expect(users.addMember).not.toHaveBeenCalled();
  });

  test("sends only known fields", async () => {
    users.create.mockResolvedValueOnce({ privateKey: "K" });
    await createUser("acme", { ...NEW, addToOrg: false, admin: true, recovery_authentication_enabled: true } as never);
    expect(users.create.mock.calls[0][1]).not.toHaveProperty("admin");
    expect(users.create.mock.calls[0][1]).not.toHaveProperty("recovery_authentication_enabled");
  });

  test("links LDAP users by name and sends no password", async () => {
    config.authMode = "ldap";
    users.create.mockResolvedValueOnce({ privateKey: "K" });
    await createUser("acme", { ...NEW, password: undefined, addToOrg: false });
    expect(users.create.mock.calls[0][1]).toEqual({
      username: "dave",
      display_name: "Dave",
      email: "dave@example.com",
      external_authentication_uid: "dave",
    });
  });

  test("validates before calling the server", async () => {
    await expect(createUser("acme", { ...NEW, username: "Dave!" })).resolves.toEqual({
      error: "invalid username",
    });
    expect(users.create).not.toHaveBeenCalled();
  });

  test("maps refusals and duplicates", async () => {
    users.create.mockRejectedValueOnce(new CincError(403, "denied"));
    await expect(createUser("acme", NEW)).resolves.toEqual({ error: "forbidden" });
    users.create.mockRejectedValueOnce(new CincError(409, "exists"));
    await expect(createUser("acme", NEW)).resolves.toEqual({ error: "already exists" });
  });
});

test("saveUserProfile merges the picked fields into the stored record", async () => {
  users.get.mockResolvedValueOnce({ username: "bob", display_name: "Bob", email: "b@x.io", city: "Here" });
  users.put.mockResolvedValueOnce({});
  await expect(
    saveUserProfile("acme", "bob", { display_name: "Robert", password: "nope" } as never),
  ).resolves.toEqual({ ok: true });
  expect(users.put).toHaveBeenCalledWith("sam", "bob", {
    username: "bob",
    display_name: "Robert",
    email: "b@x.io",
    city: "Here",
  });
});

describe("setUserPassword", () => {
  test("sets another user's password", async () => {
    users.get.mockResolvedValueOnce({ username: "bob", display_name: "Bob", email: "b@x.io" });
    users.put.mockResolvedValueOnce({});
    await expect(setUserPassword("acme", "bob", "newpass1")).resolves.toEqual({ ok: true });
    expect(users.put.mock.calls[0][2]).toMatchObject({ password: "newpass1" });
  });

  test("refuses a short password and LDAP mode", async () => {
    await expect(setUserPassword("acme", "bob", "123")).resolves.toEqual({
      error: "password too short",
    });
    config.authMode = "ldap";
    await expect(setUserPassword("acme", "bob", "newpass1")).resolves.toEqual({
      error: "passwords are managed by the directory",
    });
    expect(users.put).not.toHaveBeenCalled();
  });
});

describe("setAdmin", () => {
  test("adds a user to admins and keeps the rest", async () => {
    members.getGroup
      .mockResolvedValueOnce({ users: ["anna"], clients: [], groups: [] })
      .mockResolvedValueOnce({ users: ["anna", "bob"], clients: [], groups: [] });
    members.updateGroup.mockResolvedValueOnce({});
    await expect(setAdmin("acme", "bob", true)).resolves.toEqual({ ok: true });
    expect(members.updateGroup).toHaveBeenCalledWith("sam", "acme", "admins", {
      groupname: "admins",
      actors: { users: ["anna", "bob"] },
    });
  });

  test("removes a user from admins", async () => {
    members.getGroup
      .mockResolvedValueOnce({ users: ["anna", "bob"], clients: [], groups: [] })
      .mockResolvedValueOnce({ users: ["anna"], clients: [], groups: [] });
    members.updateGroup.mockResolvedValueOnce({});
    await expect(setAdmin("acme", "bob", false)).resolves.toEqual({ ok: true });
    expect(members.updateGroup.mock.calls[0][3]).toEqual({
      groupname: "admins",
      actors: { users: ["anna"] },
    });
  });

  test("won't remove the last admin", async () => {
    members.getGroup.mockResolvedValueOnce({ users: ["bob"], clients: [], groups: [] });
    await expect(setAdmin("acme", "bob", false)).resolves.toEqual({ error: "last admin" });
    expect(members.updateGroup).not.toHaveBeenCalled();
  });
});

describe("deleteUser", () => {
  test("deletes another user from the server", async () => {
    users.remove.mockResolvedValueOnce({});
    await expect(deleteUser("acme", "dave")).resolves.toEqual({ ok: true });
    expect(users.remove).toHaveBeenCalledWith("sam", "dave");
  });

  test("won't delete yourself or the superuser", async () => {
    await expect(deleteUser("acme", "sam")).resolves.toEqual({ error: "self" });
    await expect(deleteUser("acme", "pivotal")).resolves.toEqual({ error: "superuser" });
    expect(users.remove).not.toHaveBeenCalled();
  });
});
