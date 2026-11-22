// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { getUser, putUser, users } from "./users";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

test("getUser GETs the global /users/<name> (no org)", async () => {
  req.mockResolvedValueOnce({ username: "anna" });
  await expect(getUser("anna")).resolves.toEqual({ username: "anna" });
  expect(req).toHaveBeenCalledWith({
    user: "anna",
    method: "GET",
    path: cincPath`/users/anna`,
  });
});

test("putUser PUTs the full record to /users/<name>", async () => {
  req.mockResolvedValueOnce({});
  const body = { username: "anna", email: "a@example.com", password: "s3cret" };
  await putUser("anna", body);
  expect(req).toHaveBeenCalledWith({
    user: "anna",
    method: "PUT",
    path: cincPath`/users/anna`,
    body,
  });
});

test("a username that would retarget the signed path is rejected", () => {
  expect(() => getUser("anna/_acl")).toThrow();
  expect(req).not.toHaveBeenCalled();
});

test("users.create asks for a key pair and returns the private half once", async () => {
  req.mockResolvedValueOnce({ uri: "u", chef_key: { private_key: "SECRET" } });
  await expect(
    users.create("sam", { username: "dave", display_name: "Dave", email: "d@x.io", password: "secret1" }),
  ).resolves.toEqual({ privateKey: "SECRET" });
  expect(req).toHaveBeenCalledWith({
    user: "sam",
    method: "POST",
    path: cincPath`/users`,
    body: {
      username: "dave",
      display_name: "Dave",
      email: "d@x.io",
      password: "secret1",
      create_key: true,
    },
  });
});

test("users.create stores a pasted public key instead", async () => {
  req.mockResolvedValueOnce({ uri: "u" });
  await expect(
    users.create("sam", { username: "dave", display_name: "D", email: "d@x.io" }, "PEM"),
  ).resolves.toEqual({ privateKey: undefined });
  expect(req.mock.calls[0][0].body).toEqual({
    username: "dave",
    display_name: "D",
    email: "d@x.io",
    public_key: "PEM",
  });
});

test("users.remove DELETEs the global user", async () => {
  req.mockResolvedValueOnce({});
  await users.remove("sam", "dave");
  expect(req).toHaveBeenCalledWith({ user: "sam", method: "DELETE", path: cincPath`/users/dave` });
});

test("users.getMember reads a member through the org", async () => {
  req.mockResolvedValueOnce({ username: "bob" });
  await users.getMember("anna", "acme", "bob");
  expect(req).toHaveBeenCalledWith({
    user: "anna",
    org: "acme",
    method: "GET",
    path: cincPath`/users/bob`,
  });
});

test("users.addMember adds a user to the org directly", async () => {
  req.mockResolvedValueOnce({});
  await users.addMember("sam", "acme", "dave");
  expect(req).toHaveBeenCalledWith({
    user: "sam",
    org: "acme",
    method: "POST",
    path: cincPath`/users`,
    body: { username: "dave" },
  });
});
