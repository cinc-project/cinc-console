// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import {
  deletePolicyGroup,
  getPolicyGroup,
  groupsByRevision,
  listPolicyGroupNodes,
  listPolicyGroups,
  parsePolicyGroup,
  parsePolicyGroups,
  removePolicyFromGroup,
} from "./policy-groups";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

const LIST = {
  staging: {
    uri: "https://cinc.example/organizations/acme/policy_groups/staging",
    policies: { "web-app": { revision_id: "r2" } },
  },
  production: {
    uri: "https://cinc.example/organizations/acme/policy_groups/production",
    policies: {
      "web-app": { revision_id: "r1" },
      database: { revision_id: "d1" },
    },
  },
};

describe("parsePolicyGroup", () => {
  it("returns the pins sorted by policy name", () => {
    expect(parsePolicyGroup("production", LIST.production)).toEqual({
      name: "production",
      policies: [
        { policy: "database", revision: "d1" },
        { policy: "web-app", revision: "r1" },
      ],
    });
  });

  it("treats a group without policies as empty and skips malformed pins", () => {
    expect(parsePolicyGroup("empty", { uri: "u" })).toEqual({ name: "empty", policies: [] });
    expect(parsePolicyGroup("x", null)).toEqual({ name: "x", policies: [] });
    expect(
      parsePolicyGroup("x", { policies: { a: {}, b: { revision_id: 7 }, c: { revision_id: "c1" } } }),
    ).toEqual({ name: "x", policies: [{ policy: "c", revision: "c1" }] });
  });
});

describe("parsePolicyGroups", () => {
  it("parses every group, sorted by name", () => {
    expect(parsePolicyGroups(LIST).map((g) => g.name)).toEqual(["production", "staging"]);
  });

  it("returns [] for a malformed payload", () => {
    expect(parsePolicyGroups(null)).toEqual([]);
    expect(parsePolicyGroups(["production"])).toEqual([]);
  });
});

describe("groupsByRevision", () => {
  it("maps each revision of one policy to the groups pinning it", () => {
    const groups = parsePolicyGroups({
      ...LIST,
      qa: { policies: { "web-app": { revision_id: "r2" } } },
    });
    expect(groupsByRevision(groups, "web-app")).toEqual({
      r1: ["production"],
      r2: ["qa", "staging"],
    });
    expect(groupsByRevision(groups, "missing")).toEqual({});
  });
});

describe("requests", () => {
  it("lists groups with GET /policy_groups", async () => {
    req.mockResolvedValueOnce(LIST);
    const groups = await listPolicyGroups("anna", "acme");
    expect(groups).toHaveLength(2);
    expect(req).toHaveBeenCalledWith({
      user: "anna",
      org: "acme",
      method: "GET",
      path: cincPath`/policy_groups`,
    });
  });

  it("gets one group with GET /policy_groups/<group>", async () => {
    req.mockResolvedValueOnce(LIST.production);
    await expect(getPolicyGroup("anna", "acme", "production")).resolves.toBe(
      LIST.production,
    );
    expect(req).toHaveBeenCalledWith({
      user: "anna",
      org: "acme",
      method: "GET",
      path: cincPath`/policy_groups/production`,
    });
  });

  it("unpins a policy with DELETE /policy_groups/<group>/policies/<policy>", async () => {
    req.mockResolvedValueOnce({});
    await removePolicyFromGroup("anna", "acme", "production", "web-app");
    expect(req).toHaveBeenCalledWith({
      user: "anna",
      org: "acme",
      method: "DELETE",
      path: cincPath`/policy_groups/production/policies/web-app`,
    });
  });

  it("deletes a group with DELETE /policy_groups/<group>", async () => {
    req.mockResolvedValueOnce({});
    await deletePolicyGroup("anna", "acme", "production");
    expect(req).toHaveBeenCalledWith({
      user: "anna",
      org: "acme",
      method: "DELETE",
      path: cincPath`/policy_groups/production`,
    });
  });

  it("rejects a name that would retarget the signed path", async () => {
    await expect(
      removePolicyFromGroup("anna", "acme", "production", "../../nodes/x"),
    ).rejects.toThrow();
    await expect(deletePolicyGroup("anna", "acme", "prod/_acl")).rejects.toThrow();
    expect(req).not.toHaveBeenCalled();
  });
});

describe("listPolicyGroupNodes", () => {
  it("partial-searches nodes by escaped policy_group and sorts by name", async () => {
    req.mockResolvedValueOnce({
      total: 3,
      start: 0,
      rows: [
        { url: "u", data: { name: "web02", policy_name: "web-app" } },
        { url: "u", data: { name: "db01", policy_name: null } },
        { url: "u", data: { policy_name: "orphan" } },
      ],
    });
    await expect(listPolicyGroupNodes("anna", "acme", "prod:eu")).resolves.toEqual([
      { name: "db01", policyName: null },
      { name: "web02", policyName: "web-app" },
    ]);
    expect(req).toHaveBeenCalledWith({
      user: "anna",
      org: "acme",
      method: "POST",
      path: cincPath`/search/node`,
      query: { q: "policy_group:prod\\:eu", rows: 1000, start: 0 },
      body: { name: ["name"], policy_name: ["policy_name"] },
    });
  });
});
