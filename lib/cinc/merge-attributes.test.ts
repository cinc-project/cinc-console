// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mergeAttributes, leaves, countLeaves, type MergedNode } from "./merge-attributes";

function find(nodes: MergedNode[], path: string): MergedNode | undefined {
  const [head, ...rest] = path.split(".");
  const n = nodes.find((x) => x.key === head);
  if (!n || rest.length === 0) return n;
  return n.kind === "branch" ? find(n.children, rest.join(".")) : undefined;
}

describe("mergeAttributes", () => {
  it("lets higher levels win and records what they shadow", () => {
    const merged = mergeAttributes({
      default: { audit: { reporter: "json-file", quiet: false } },
      normal: { audit: { reporter: "cli" } },
      override: { audit: { reporter: "automate" } },
    });
    expect(find(merged, "audit.reporter")).toMatchObject({
      kind: "leaf",
      value: "automate",
      source: "override",
      shadowed: [
        { level: "normal", value: "cli" },
        { level: "default", value: "json-file" },
      ],
    });
    expect(find(merged, "audit.quiet")).toMatchObject({ value: false, source: "default", shadowed: [] });
    expect(find(merged, "audit")).toMatchObject({
      kind: "branch",
      sources: ["default", "normal", "override"],
    });
  });

  it("replaces arrays rather than concatenating across levels", () => {
    const merged = mergeAttributes({
      default: { pkgs: ["a", "b"] },
      override: { pkgs: ["c"] },
    });
    expect(find(merged, "pkgs")).toMatchObject({ value: ["c"], source: "override" });
  });

  it("lets a higher scalar cut off a lower hash entirely", () => {
    const merged = mergeAttributes({
      default: { x: { deep: 1 } },
      normal: { x: "flat" },
    });
    expect(find(merged, "x")).toMatchObject({ kind: "leaf", value: "flat", source: "normal" });
  });

  it("lets a higher hash replace a lower scalar and merge above it", () => {
    const merged = mergeAttributes({
      default: { x: "flat" },
      normal: { x: { a: 1 } },
      override: { x: { b: 2 } },
    });
    const x = find(merged, "x");
    expect(x).toMatchObject({ kind: "branch", sources: ["normal", "override"] });
    expect(find(merged, "x.a")).toMatchObject({ value: 1, source: "normal" });
    expect(find(merged, "x.b")).toMatchObject({ value: 2, source: "override" });
  });

  it("puts automatic on top", () => {
    const merged = mergeAttributes({
      override: { fqdn: "wrong" },
      automatic: { fqdn: "web01.example" },
    });
    expect(find(merged, "fqdn")).toMatchObject({ value: "web01.example", source: "automatic" });
  });

  it("keeps first-seen key order and full paths", () => {
    const merged = mergeAttributes({ default: { b: 1, a: { c: 2 } }, normal: { z: 3 } });
    expect(merged.map((n) => n.key)).toEqual(["b", "a", "z"]);
    expect(leaves(merged).map((l) => l.path.join("."))).toEqual(["b", "a.c", "z"]);
  });

  it("skips missing or malformed levels", () => {
    expect(mergeAttributes({ default: null, normal: "x", override: [1] })).toEqual([]);
  });
});

describe("countLeaves", () => {
  it("counts every non-hash value", () => {
    expect(countLeaves({ a: 1, b: { c: [1, 2], d: { e: null } } })).toBe(3);
    expect(countLeaves(undefined)).toBe(0);
  });
});
