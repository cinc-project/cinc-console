// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class Unauthorized extends Error {}
  return {
    Unauthorized,
    requireUser: vi.fn(),
    loadFleetSnapshot: vi.fn(),
  };
});
vi.mock("@/lib/session", () => ({
  requireUser: mocks.requireUser,
  Unauthorized: mocks.Unauthorized,
}));
vi.mock("@/lib/cinc/fleet-snapshot", () => ({
  loadFleetSnapshot: mocks.loadFleetSnapshot,
}));
vi.mock("@/lib/cinc/client", () => ({ nowMs: () => 1_000 }));

import { GET } from "./route";

const call = (org = "acme") =>
  GET(new Request(`https://console.test/orgs/${org}/fleet`), {
    params: Promise.resolve({ org }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue("anna");
});

test("returns the snapshot as uncached JSON for the session user", async () => {
  const snapshot = { stats: { total: 0 }, nodes: [], generatedAt: 1_000 };
  mocks.loadFleetSnapshot.mockResolvedValue({ data: snapshot });

  const res = await call();

  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  await expect(res.json()).resolves.toEqual(snapshot);
  expect(mocks.loadFleetSnapshot).toHaveBeenCalledWith("anna", "acme", 1_000);
});

test("no session gets a JSON 401, not a redirect", async () => {
  mocks.requireUser.mockRejectedValue(new mocks.Unauthorized());

  const res = await call();

  expect(res.status).toBe(401);
  expect(res.headers.get("location")).toBeNull();
  await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
  expect(mocks.loadFleetSnapshot).not.toHaveBeenCalled();
});

test("an ACL error is handed to the client with status 200", async () => {
  mocks.loadFleetSnapshot.mockResolvedValue({ error: "forbidden" });

  const res = await call();

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({ error: "forbidden" });
});

test("an unexpected session failure is not swallowed", async () => {
  mocks.requireUser.mockRejectedValue(new Error("iron-session exploded"));
  await expect(call()).rejects.toThrow("iron-session exploded");
});
