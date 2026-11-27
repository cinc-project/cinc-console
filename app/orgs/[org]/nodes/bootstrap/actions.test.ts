// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "alice" }));

const { createClient, deleteClient, getNode } = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteClient: vi.fn(),
  getNode: vi.fn(),
}));
vi.mock("@/lib/cinc/clients", () => ({ createClient, deleteClient }));
vi.mock("@/lib/cinc/resource", () => ({ makeResource: () => ({ get: getNode }) }));

import { createBootstrapClient, discardBootstrapClient, nodeCheckIn } from "./actions";

beforeEach(() => {
  createClient.mockReset();
  deleteClient.mockReset();
  getNode.mockReset();
});

const missing = () => getNode.mockRejectedValueOnce(new CincError(404, "nope"));

describe("createBootstrapClient", () => {
  test("creates the client and returns its one-time key", async () => {
    missing();
    createClient.mockResolvedValueOnce({ name: "web01", privateKey: "PEM" });
    await expect(createBootstrapClient("acme", "web01")).resolves.toEqual({
      ok: true,
      privateKey: "PEM",
    });
    expect(getNode).toHaveBeenCalledWith("alice", "acme", "web01");
    expect(createClient).toHaveBeenCalledWith("alice", "acme", "web01");
  });

  test("refuses when a node of that name exists", async () => {
    getNode.mockResolvedValueOnce({ name: "web01" });
    await expect(createBootstrapClient("acme", "web01")).resolves.toEqual({
      error: "node exists",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  test.each([["a:b"], [42], [""], [{ name: "x" }]])(
    "rejects %j without a request",
    async (name) => {
      await expect(createBootstrapClient("acme", name)).resolves.toEqual({
        error: "invalid name",
      });
      expect(getNode).not.toHaveBeenCalled();
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  test("maps a client conflict to already exists", async () => {
    missing();
    createClient.mockRejectedValueOnce(new CincError(409, "exists"));
    await expect(createBootstrapClient("acme", "web01")).resolves.toEqual({
      error: "already exists",
    });
  });

  test("maps 403 to forbidden", async () => {
    missing();
    createClient.mockRejectedValueOnce(new CincError(403, "no"));
    await expect(createBootstrapClient("acme", "web01")).resolves.toEqual({
      error: "forbidden",
    });
  });
});

describe("discardBootstrapClient", () => {
  test("deletes the client while no node exists", async () => {
    missing();
    deleteClient.mockResolvedValueOnce(undefined);
    await expect(discardBootstrapClient("acme", "web01")).resolves.toEqual({ ok: true });
    expect(deleteClient).toHaveBeenCalledWith("alice", "acme", "web01");
  });

  test("keeps the client once the node exists", async () => {
    getNode.mockResolvedValueOnce({ name: "web01" });
    await expect(discardBootstrapClient("acme", "web01")).resolves.toEqual({
      error: "node exists",
    });
    expect(deleteClient).not.toHaveBeenCalled();
  });

  test("a client that is already gone counts as discarded", async () => {
    missing();
    deleteClient.mockRejectedValueOnce(new CincError(404, "gone"));
    await expect(discardBootstrapClient("acme", "web01")).resolves.toEqual({ ok: true });
  });

  test("rejects an invalid name", async () => {
    await expect(discardBootstrapClient("acme", "a:b")).resolves.toEqual({
      error: "invalid name",
    });
    expect(deleteClient).not.toHaveBeenCalled();
  });
});

describe("nodeCheckIn", () => {
  test("waiting while the node doesn't exist", async () => {
    missing();
    await expect(nodeCheckIn("acme", "web01")).resolves.toEqual({ state: "waiting" });
  });

  test("registered once the node exists without a completed run", async () => {
    getNode.mockResolvedValueOnce({ name: "web01", automatic: {} });
    await expect(nodeCheckIn("acme", "web01")).resolves.toEqual({ state: "registered" });
  });

  test("checked in once ohai_time is set", async () => {
    getNode.mockResolvedValueOnce({
      name: "web01",
      automatic: { ohai_time: 1764180000.5, platform: "ubuntu", platform_version: "24.04" },
    });
    await expect(nodeCheckIn("acme", "web01")).resolves.toEqual({
      state: "checked-in",
      ohaiTime: 1764180000.5,
      platform: "ubuntu 24.04",
    });
  });

  test("forbidden reads surface as an error", async () => {
    getNode.mockRejectedValueOnce(new CincError(403, "no"));
    await expect(nodeCheckIn("acme", "web01")).resolves.toEqual({ error: "forbidden" });
  });
});
