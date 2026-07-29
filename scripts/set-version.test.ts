// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SEMVER, TARGETS, inspect } from "./set-version.mjs";

const target = (file: string) => {
  const found = TARGETS.find((t) => t.file.endsWith(file));
  if (!found) throw new Error(`no target for ${file}`);
  return found;
};

const PACKAGE_JSON = `{
  "name": "cinc-console",
  "version": "0.1.1",
  "private": true,
  "dependencies": {
    "next": "16.2.9",
    "zod": "^4.4.3"
  }
}
`;

const CHART_YAML = `apiVersion: v2
name: cinc-console
type: application
version: 0.1.1
appVersion: "0.1.1"
keywords:
  - cinc
`;

describe("SEMVER", () => {
  it("accepts bare semver, with or without a prerelease", () => {
    expect(SEMVER.test("0.5.0")).toBe(true);
    expect(SEMVER.test("1.10.2")).toBe(true);
    expect(SEMVER.test("0.5.0-rc.1")).toBe(true);
  });

  it("rejects a leading v, partial versions, and shell metacharacters", () => {
    for (const bad of ["v0.5.0", "0.5", "", "0.5.0; rm -rf /", "$(id)", "0.5.0 && echo"]) {
      expect(SEMVER.test(bad)).toBe(false);
    }
  });
});

describe("package.json target", () => {
  const t = target("package.json");

  it("rewrites the top-level version", () => {
    const after = t.set(PACKAGE_JSON, "0.5.0");
    expect(JSON.parse(after).version).toBe("0.5.0");
    expect(inspect(t, after, "0.5.0").ok).toBe(true);
  });

  it("leaves nested dependency versions alone", () => {
    const after = t.set(PACKAGE_JSON, "0.5.0");
    const deps = JSON.parse(after).dependencies;
    expect(deps).toEqual({ next: "16.2.9", zod: "^4.4.3" });
  });

  it("changes exactly one line, so the release diff stays readable", () => {
    const after = t.set(PACKAGE_JSON, "0.5.0");
    const changed = after
      .split("\n")
      .filter((line, i) => line !== PACKAGE_JSON.split("\n")[i]);
    expect(changed).toEqual(['  "version": "0.5.0",']);
  });

  it("reports the version it found when checking", () => {
    expect(inspect(t, PACKAGE_JSON, "0.5.0")).toEqual({ found: ["0.1.1"], ok: false });
    expect(inspect(t, PACKAGE_JSON, "0.1.1").ok).toBe(true);
  });
});

describe("Chart.yaml target", () => {
  const t = target("Chart.yaml");

  it("moves version and appVersion in lockstep, quoting appVersion", () => {
    const after = t.set(CHART_YAML, "0.5.0");
    expect(after).toContain("\nversion: 0.5.0\n");
    expect(after).toContain('\nappVersion: "0.5.0"\n');
    expect(inspect(t, after, "0.5.0")).toEqual({ found: ["0.5.0", "0.5.0"], ok: true });
  });

  it("leaves the rest of the chart metadata untouched", () => {
    const after = t.set(CHART_YAML, "0.5.0");
    expect(after).toContain("apiVersion: v2\nname: cinc-console\ntype: application\n");
    expect(after).toContain("keywords:\n  - cinc\n");
  });

  it("fails the check when only one of the two fields was bumped", () => {
    const half = CHART_YAML.replace("version: 0.1.1", "version: 0.5.0");
    expect(inspect(t, half, "0.5.0")).toEqual({ found: ["0.5.0", "0.1.1"], ok: false });
  });
});

describe("every target", () => {
  it("is idempotent", () => {
    for (const [t, text] of [
      [target("package.json"), PACKAGE_JSON],
      [target("Chart.yaml"), CHART_YAML],
    ] as const) {
      const once = t.set(text, "0.5.0");
      expect(t.set(once, "0.5.0")).toBe(once);
    }
  });

  it("treats a file declaring no version as a mismatch, not a pass", () => {
    for (const t of TARGETS) {
      expect(inspect(t, "# nothing here\n", "0.5.0")).toEqual({ found: [], ok: false });
    }
  });
});
