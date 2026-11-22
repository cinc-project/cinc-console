// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { keys, loadKeys, type KeyOwner } from "./keys";
import { cincPath } from "./path";
import { CincError } from "./errors";

const USER: KeyOwner = { kind: "user", name: "bob" };
const CLIENT: KeyOwner = { kind: "client", org: "acme", name: "web01" };

// A block body: vitest runs a function returned from beforeEach as a cleanup
// hook, and mockReset() returns the mock, which would then be called.
beforeEach(() => {
  req.mockReset();
});

test("user keys live under /users/<name>/keys, outside any org", async () => {
  req.mockResolvedValueOnce([]);
  await keys.list("alice", USER);
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: undefined,
    method: "GET",
    path: cincPath`/users/bob/keys`,
  });
});

test("client keys live under the org's /clients/<name>/keys", async () => {
  req.mockResolvedValueOnce({});
  await keys.get("alice", CLIENT, "default");
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    org: "acme",
    method: "GET",
    path: cincPath`/clients/web01/keys/default`,
  });
});

test("create with a public key stores it and returns no private key", async () => {
  req.mockResolvedValueOnce({ uri: "u" });
  await expect(
    keys.create("alice", USER, { name: "laptop", publicKey: "PEM", expirationDate: "infinity" }),
  ).resolves.toEqual({ privateKey: undefined });
  expect(req.mock.calls[0][0]).toMatchObject({
    method: "POST",
    body: { name: "laptop", public_key: "PEM", expiration_date: "infinity" },
  });
});

test("create without a public key asks the server for a pair and returns the private half", async () => {
  req.mockResolvedValueOnce({ uri: "u", private_key: "SECRET" });
  await expect(
    keys.create("alice", USER, { name: "ci", expirationDate: "2030-01-01T00:00:00Z" }),
  ).resolves.toEqual({ privateKey: "SECRET" });
  // erchef needs create_key: true; cinc-server-ng generates when public_key is absent.
  expect(req.mock.calls[0][0].body).toEqual({
    name: "ci",
    create_key: true,
    expiration_date: "2030-01-01T00:00:00Z",
  });
});

test("update sends only the fields given", async () => {
  req.mockResolvedValueOnce({});
  await keys.update("alice", CLIENT, "old", { name: "new" });
  expect(req.mock.calls[0][0]).toMatchObject({
    method: "PUT",
    path: cincPath`/clients/web01/keys/old`,
    body: { name: "new" },
  });
});

test("regenerate replaces the pair in place and returns the new private key", async () => {
  req.mockResolvedValueOnce({ private_key: "NEW" });
  await expect(keys.regenerate("alice", CLIENT, "default")).resolves.toBe("NEW");
  expect(req.mock.calls[0][0]).toMatchObject({
    method: "PUT",
    path: cincPath`/clients/web01/keys/default`,
    body: { create_key: true },
  });
});

test("regenerate fails loudly when the server returns no private key", async () => {
  req.mockResolvedValueOnce({});
  await expect(keys.regenerate("alice", CLIENT, "default")).rejects.toThrow();
});

test("remove DELETEs the key", async () => {
  req.mockResolvedValueOnce({});
  await keys.remove("alice", USER, "laptop");
  expect(req.mock.calls[0][0]).toMatchObject({
    method: "DELETE",
    path: cincPath`/users/bob/keys/laptop`,
  });
});

test("loadKeys joins the list with each key's expiration date", async () => {
  req.mockImplementation(async ({ path }: { path: string }) => {
    if (path === "/users/bob/keys")
      return [
        { name: "default", expired: false },
        { name: "old", expired: true },
      ];
    if (path === "/users/bob/keys/default") return { name: "default", expiration_date: "infinity" };
    if (path === "/users/bob/keys/old") throw new CincError(403, "denied");
    throw new Error(`unexpected ${path}`);
  });
  await expect(loadKeys("alice", USER)).resolves.toEqual([
    { name: "default", expired: false, expires: null },
    // A key whose detail can't be read still lists, with its expiry unknown.
    { name: "old", expired: true, expires: undefined },
  ]);
});
