// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { CincError } from "./errors";

const req = vi.fn();
const getConfigMock = vi.fn();

vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));
vi.mock("../config", () => ({ getConfig: () => getConfigMock() }));

import { authenticateUser } from "./auth";
import { cincPath } from "./path";

beforeEach(() => {
  req.mockReset();
  getConfigMock.mockReturnValue({ authActor: undefined });
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
