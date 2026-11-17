import { describe, it, expect } from "vitest";
import { nodeFacts } from "@/lib/cinc/node-facts";
import { checkInLine, clientLine, configLine, osLine, monthYear } from "./node-status";

const NOW = 1_800_000_000_000;
const facts = (node: Record<string, unknown>) => nodeFacts(node);

describe("checkInLine", () => {
  it("says how long ago, and flags missing / never", () => {
    expect(checkInLine(facts({ automatic: { ohai_time: NOW / 1000 - 840 } }), NOW)).toEqual({
      tone: "success",
      text: "Checked in 14m ago",
    });
    expect(checkInLine(facts({ automatic: { ohai_time: NOW / 1000 - 3 * 86400 } }), NOW)).toEqual({
      tone: "danger",
      text: "Missing: last check-in 3d ago",
    });
    expect(checkInLine(facts({}), NOW)).toEqual({ tone: "warn", text: "Never checked in" });
  });
});

describe("clientLine", () => {
  const v = (version: string) => facts({ automatic: { chef_packages: { chef: { version } } } });
  it("words each lifecycle status", () => {
    expect(clientLine(v("18.8.54"), "major-behind", 19)).toEqual({ tone: "warn", text: "Client 18.8.54, one major behind" });
    expect(clientLine(v("16.1.0"), "major-behind", 19)).toEqual({ tone: "warn", text: "Client 16.1.0, 3 majors behind" });
    expect(clientLine(v("17.10.0"), "eol", 19)).toEqual({ tone: "danger", text: "Client 17.10.0 is end-of-life" });
    expect(clientLine(v("19.3.15"), "current", 19)).toEqual({ tone: "success", text: "Client 19.3.15, current" });
    expect(clientLine(facts({}), "unknown", 19)).toEqual({ tone: "muted", text: "Client version not reported" });
  });
});

describe("configLine", () => {
  it("explains why a node is unconfigured", () => {
    expect(configLine(facts({ chef_environment: "_default", run_list: [] })).text).toBe("No run list, in _default");
    expect(configLine(facts({ chef_environment: "prod", run_list: [] })).text).toBe("No run list");
    expect(configLine(facts({ chef_environment: "_default", run_list: ["role[web]"] })).text).toBe("In the _default environment");
  });
  it("is positive for configured and policyfile nodes", () => {
    expect(configLine(facts({ chef_environment: "prod", run_list: ["role[web]", "recipe[a]"] }))).toEqual({
      tone: "success",
      text: "Run list: 2 entries",
    });
    expect(configLine(facts({ policy_name: "web", policy_group: "prod" })).text).toBe("Policy web (prod)");
  });
});

describe("osLine", () => {
  it("formats support dates and omits unknown", () => {
    expect(osLine({ status: "supported", until: "2030-06-30" })).toEqual({ tone: "success", text: "OS supported until Jun 2030" });
    expect(osLine({ status: "eol", since: "2024-06-30" })).toEqual({ tone: "danger", text: "OS end-of-life since Jun 2024" });
    expect(osLine({ status: "unknown" })).toBeNull();
  });
  it("formats month-year in UTC", () => {
    expect(monthYear("2030-01-01")).toBe("Jan 2030");
  });
});
