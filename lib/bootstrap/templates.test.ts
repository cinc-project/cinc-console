import { describe, expect, it } from "vitest";
import type { FleetNode } from "@/lib/cinc/fleet";
import { templatesFromFleet } from "./templates";

function node(p: Partial<FleetNode> & { name: string }): FleetNode {
  return {
    ohaiTime: null,
    runList: [],
    policyName: null,
    policyGroup: null,
    chefVersion: null,
    environment: null,
    platform: null,
    platformVersion: null,
    ...p,
  };
}

describe("templatesFromFleet", () => {
  it("copies a roles node's environment and run list", () => {
    const [t] = templatesFromFleet([
      node({ name: "seed-web01", environment: "_default", runList: ["role[base]", "recipe[apt]"] }),
    ]);
    expect(t).toEqual({
      node: "seed-web01",
      settings: { mode: "roles", environment: "_default", runList: ["role[base]", "recipe[apt]"] },
      summary: "role[base], recipe[apt] in _default",
    });
  });

  it("copies a policy node as policy mode, with no environment", () => {
    const [t] = templatesFromFleet([
      node({ name: "seed-policy01", environment: "_default", policyName: "web-app", policyGroup: "production" }),
    ]);
    expect(t).toEqual({
      node: "seed-policy01",
      settings: { mode: "policy", policyGroup: "production", policyName: "web-app" },
      summary: "web-app from group production",
    });
  });

  it("describes an empty run list and defaults a missing environment", () => {
    const [t] = templatesFromFleet([node({ name: "bare" })]);
    expect(t.settings).toEqual({ mode: "roles", environment: "_default", runList: [] });
    expect(t.summary).toBe("no run list in _default");
  });

  it("drops a node whose settings can't be reproduced", () => {
    expect(templatesFromFleet([node({ name: "odd", runList: ["bogus"] })])).toEqual([]);
  });

  it("sorts by node name", () => {
    const names = templatesFromFleet([node({ name: "b" }), node({ name: "a" })]).map((t) => t.node);
    expect(names).toEqual(["a", "b"]);
  });
});
