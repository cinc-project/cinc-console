// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { CincError } from "./errors";

const req = vi.fn();
const getConfigMock = vi.fn();
const getUserMock = vi.fn();
const ldapBindMock = vi.fn();
// vi.hoisted: this factory runs at the same hoisted position as the vi.mock
// calls below, so `logMock` is initialized before "../log" is first
// resolved (a bare const here would hit a TDZ error instead).
const { logMock } = vi.hoisted(() => ({
  logMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));
vi.mock("../config", () => ({ getConfig: () => getConfigMock() }));
vi.mock("./users", () => ({ getUser: (...a: unknown[]) => getUserMock(...a) }));
vi.mock("../log", () => ({ log: logMock }));
// Keep the real LdapAuthError class (auth.ts does `instanceof` checks on it)
// but stub ldapBind itself so tests never touch a real directory.
vi.mock("../ldap/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ldap/client")>();
  return { ...actual, ldapBind: (...a: unknown[]) => ldapBindMock(...a) };
});

import { authenticateUser, authenticate } from "./auth";
import { cincPath } from "./path";
import { LdapAuthError } from "../ldap/client";

beforeEach(() => {
  req.mockReset();
  getUserMock.mockReset();
  ldapBindMock.mockReset();
  logMock.info.mockReset();
  logMock.warn.mockReset();
  logMock.error.mockReset();
  getConfigMock.mockReturnValue({ authActor: undefined, authMode: "local" });
});

test("returns the user (with display_name) on success", async () => {
  req.mockResolvedValueOnce({ user: { username: "alice", display_name: "Alice A" } });
  await expect(authenticateUser("alice", "pw")).resolves.toEqual({
    username: "alice",
    display_name: "Alice A",
  });
  expect(req).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "POST",
      path: cincPath`/authenticate_user`,
      body: { username: "alice", password: "pw" },
    }),
  );
});

test("falls back to the username when the response has no user", async () => {
  req.mockResolvedValueOnce({ status: "linked" });
  await expect(authenticateUser("alice", "pw")).resolves.toEqual({
    username: "alice",
  });
});

test("returns null on 401", async () => {
  req.mockRejectedValueOnce(new CincError(401, "bad"));
  await expect(authenticateUser("alice", "bad")).resolves.toBeNull();
});

test("rethrows non-401 errors", async () => {
  req.mockRejectedValueOnce(new CincError(500, "boom"));
  await expect(authenticateUser("alice", "pw")).rejects.toMatchObject({
    status: 500,
  });
});

test("signs as authActor when configured", async () => {
  getConfigMock.mockReturnValue({ authActor: "pivotal" });
  req.mockResolvedValueOnce({ user: { username: "alice" } });

  await authenticateUser("alice", "pw");

  expect(req).toHaveBeenCalledTimes(1);
  expect(req).toHaveBeenCalledWith(
    expect.objectContaining({
      user: "pivotal",
      onBehalfOf: "alice",
      path: cincPath`/authenticate_user`,
      body: { username: "alice", password: "pw" },
    }),
  );
});

test("signs as username when authActor is not configured", async () => {
  getConfigMock.mockReturnValue({ authActor: undefined });
  req.mockResolvedValueOnce({ user: { username: "alice" } });

  await authenticateUser("alice", "pw");

  expect(req).toHaveBeenCalledWith(
    expect.objectContaining({
      user: "alice",
      path: cincPath`/authenticate_user`,
    }),
  );
});

// --- authenticate() composite: branches on AUTH_MODE ---

test("authenticate() in local mode delegates to authenticateUser unchanged", async () => {
  getConfigMock.mockReturnValue({ authActor: undefined, authMode: "local" });
  req.mockResolvedValueOnce({ user: { username: "alice", display_name: "Alice A" } });

  await expect(authenticate("alice", "pw")).resolves.toEqual({
    username: "alice",
    displayName: "Alice A",
  });
  expect(ldapBindMock).not.toHaveBeenCalled();
});

test("authenticate() in local mode returns null on bad credentials", async () => {
  getConfigMock.mockReturnValue({ authActor: undefined, authMode: "local" });
  req.mockRejectedValueOnce(new CincError(401, "bad"));

  await expect(authenticate("alice", "bad")).resolves.toBeNull();
});

test("authenticate() in ldap mode: bind + chef user lookup succeed", async () => {
  getConfigMock.mockReturnValue({ authMode: "ldap" });
  ldapBindMock.mockResolvedValueOnce({ dn: "uid=alice,dc=example,dc=com" });
  getUserMock.mockResolvedValueOnce({ username: "alice", display_name: "Alice A" });

  await expect(authenticate("alice", "pw")).resolves.toEqual({
    username: "alice",
    displayName: "Alice A",
  });
  expect(req).not.toHaveBeenCalled(); // never falls through to /authenticate_user
});

test("authenticate() in ldap mode: bind succeeds but no matching Cinc user -> null, distinct log", async () => {
  getConfigMock.mockReturnValue({ authMode: "ldap" });
  ldapBindMock.mockResolvedValueOnce({ dn: "uid=ghost,dc=example,dc=com" });
  getUserMock.mockRejectedValueOnce(new CincError(404, "not found"));

  await expect(authenticate("ghost", "pw")).resolves.toBeNull();
  expect(logMock.error).toHaveBeenCalledWith(
    "auth.ldap_ok_no_chef_user",
    expect.objectContaining({ user: "ghost" }),
  );
});

test("authenticate() in ldap mode: bad password -> null, logs auth.ldap_failed", async () => {
  getConfigMock.mockReturnValue({ authMode: "ldap" });
  ldapBindMock.mockRejectedValueOnce(new LdapAuthError("invalid_credentials", "bad LDAP password"));

  await expect(authenticate("alice", "wrong")).resolves.toBeNull();
  expect(logMock.warn).toHaveBeenCalledWith(
    "auth.ldap_failed",
    expect.objectContaining({ user: "alice", reason: "invalid_credentials" }),
  );
});

test("authenticate() in ldap mode: directory unreachable -> null, logs auth.ldap_unavailable at error level", async () => {
  getConfigMock.mockReturnValue({ authMode: "ldap" });
  ldapBindMock.mockRejectedValueOnce(new LdapAuthError("connection_error", "ECONNREFUSED"));

  await expect(authenticate("alice", "pw")).resolves.toBeNull();
  expect(logMock.error).toHaveBeenCalledWith(
    "auth.ldap_unavailable",
    expect.objectContaining({ user: "alice" }),
  );
  expect(logMock.warn).not.toHaveBeenCalled();
});

test("authenticate() in ldap mode: a non-404 Cinc error from getUser is rethrown, not swallowed", async () => {
  getConfigMock.mockReturnValue({ authMode: "ldap" });
  ldapBindMock.mockResolvedValueOnce({ dn: "uid=alice,dc=example,dc=com" });
  getUserMock.mockRejectedValueOnce(new CincError(500, "boom"));

  await expect(authenticate("alice", "pw")).rejects.toMatchObject({ status: 500 });
});
