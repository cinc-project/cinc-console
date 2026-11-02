// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { getUser, putUser } from "./users";
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
