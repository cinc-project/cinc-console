import { describe, expect, it } from "vitest";
import { bootstrapNameError, runListEntryError, settingsError } from "./validate";

describe("bootstrapNameError", () => {
  it("accepts a name that is valid for both a node and a client", () => {
    expect(bootstrapNameError("web01")).toBeNull();
    expect(bootstrapNameError("web01.home.lan")).toBeNull();
  });

  it("asks for a name when empty", () => {
    expect(bootstrapNameError("")).toBe("Enter a name.");
    expect(bootstrapNameError("   ")).toBe("Enter a name.");
  });

  it("rejects a colon, which a node allows but a client does not", () => {
    expect(bootstrapNameError("a:b")).toContain("also the client");
  });

  it("rejects characters neither allows", () => {
    expect(bootstrapNameError("web 01")).not.toBeNull();
  });
});

describe("runListEntryError", () => {
  it.each([
    "role[base]",
    "recipe[apt]",
    "recipe[apt::default]",
    "recipe[apt@1.2.3]",
    "recipe[apt::default@1.2]",
    "recipe[my-cb_2]",
  ])("accepts %s", (entry) => {
    expect(runListEntryError(entry)).toBeNull();
  });

  it.each([
    "role[base",
    "role[a.b]",
    "base",
    "recipe[]",
    "recipe[apt@x]",
    "role[base]; rm -rf /",
    "recipe[a]\nrecipe[b]",
  ])("rejects %j", (entry) => {
    expect(runListEntryError(entry)).not.toBeNull();
  });
});

describe("settingsError", () => {
  it("accepts _default with an empty run list", () => {
    expect(settingsError({ mode: "roles", environment: "_default", runList: [] })).toBeNull();
  });

  it("rejects a bad environment", () => {
    expect(settingsError({ mode: "roles", environment: "pro d", runList: [] })).not.toBeNull();
  });

  it("rejects a bad run-list entry", () => {
    expect(
      settingsError({ mode: "roles", environment: "prod", runList: ["role[ok]", "nope"] }),
    ).not.toBeNull();
  });

  it("requires both policy group and policy name", () => {
    expect(settingsError({ mode: "policy", policyGroup: "prod", policyName: "" })).not.toBeNull();
    expect(settingsError({ mode: "policy", policyGroup: "", policyName: "web" })).not.toBeNull();
    expect(settingsError({ mode: "policy", policyGroup: "prod", policyName: "web" })).toBeNull();
  });

  it("rejects a malformed policy name", () => {
    expect(settingsError({ mode: "policy", policyGroup: "prod", policyName: "a b" })).not.toBeNull();
  });

  it("rejects values with surrounding whitespace", () => {
    expect(settingsError({ mode: "roles", environment: "prod ", runList: [] })).not.toBeNull();
    expect(settingsError({ mode: "policy", policyGroup: "prod\n", policyName: "web" })).not.toBeNull();
    expect(settingsError({ mode: "policy", policyGroup: "prod", policyName: " web" })).not.toBeNull();
  });
});
