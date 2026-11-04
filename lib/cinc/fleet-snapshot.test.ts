// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchFleetNodes: vi.fn(),
  getClientLifecycle: vi.fn(),
}));
vi.mock("./search", () => ({ fetchFleetNodes: mocks.fetchFleetNodes }));
vi.mock("./client-lifecycle", () => ({
  getClientLifecycle: mocks.getClientLifecycle,
}));

import { CincError } from "./errors";
import { loadFleetSnapshot } from "./fleet-snapshot";
import type { FleetNode } from "./fleet";

const NOW = Date.UTC(2026, 10, 2, 12);
const node = (name: string, ohaiTime: number | null): FleetNode => ({
  name,
  ohaiTime,
  runList: ["recipe[base]"],
  policyName: null,
  policyGroup: null,
  chefVersion: "18.5.0",
  environment: "production",
  platform: "ubuntu",
  platformVersion: "24.04",
});
const lifecycle = { latestMajor: 19, latestVersion: "19.1.0", eolMajors: [16] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClientLifecycle.mockResolvedValue(lifecycle);
});

test("folds the fleet and lifecycle into a snapshot for the caller's user/org", async () => {
  mocks.fetchFleetNodes.mockResolvedValue([
    node("web01", NOW / 1000 - 60),
    node("db01", null),
  ]);

  const res = await loadFleetSnapshot("anna", "acme", NOW);

  expect(mocks.fetchFleetNodes).toHaveBeenCalledWith("anna", "acme");
  expect(mocks.getClientLifecycle).toHaveBeenCalledWith(NOW);
  if (!("data" in res)) throw new Error(`expected data, got ${res.error}`);
  expect(res.data.generatedAt).toBe(NOW);
  expect(res.data.stats).toMatchObject({
    total: 2,
    missing: 1,
    latestMajor: 19,
    latestVersion: "19.1.0",
  });
  // Most recently seen first.
  expect(res.data.nodes.map((n) => n.name)).toEqual(["web01", "db01"]);
});

test("a 403 on the fleet search becomes { error: 'forbidden' }", async () => {
  mocks.fetchFleetNodes.mockRejectedValue(new CincError(403, {}));
  await expect(loadFleetSnapshot("anna", "acme", NOW)).resolves.toEqual({
    error: "forbidden",
  });
});

test("a server error on the fleet search is reported, not thrown", async () => {
  mocks.fetchFleetNodes.mockRejectedValue(new CincError(502, {}));
  await expect(loadFleetSnapshot("anna", "acme", NOW)).resolves.toEqual({
    error: "server error (502)",
  });
});

test("an unexpected error propagates", async () => {
  mocks.fetchFleetNodes.mockRejectedValue(new TypeError("bug"));
  await expect(loadFleetSnapshot("anna", "acme", NOW)).rejects.toThrow("bug");
});
