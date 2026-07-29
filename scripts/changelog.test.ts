// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  addRelease,
  extractSection,
  renderBullets,
  splitSections,
} from "./changelog.mjs";

const PREAMBLE = `# Changelog

All notable changes to this project are documented in this file.

`;

const CHANGELOG = `${PREAMBLE}## 0.4.0 - 2026-06-30

### Merged pull requests

- Use matched brackets in the missing-count range query (#58)

## 0.1.0

- Initial release of Cinc Console.
`;

describe("splitSections", () => {
  it("keeps the preamble out of the sections", () => {
    const { preamble, sections } = splitSections(CHANGELOG);
    expect(preamble).toBe(PREAMBLE);
    expect(sections.map((s) => s.heading)).toEqual(["## 0.4.0 - 2026-06-30", "## 0.1.0"]);
  });

  it("round-trips a changelog byte-for-byte", () => {
    const { preamble, sections } = splitSections(CHANGELOG);
    expect(preamble + sections.map((s) => `${s.heading}\n${s.body}`).join("")).toBe(CHANGELOG);
  });

  it("treats a file with no sections as all preamble", () => {
    expect(splitSections("# Changelog\n")).toEqual({ preamble: "# Changelog\n", sections: [] });
  });
});

describe("renderBullets", () => {
  it("splits dependency bumps out of the main list", () => {
    expect(
      renderBullets([
        "Add Duplicate for roles and environments (#59)",
        "chore(deps): bump next from 16.2.9 to 16.2.11 (#72)",
        "Triage Semgrep findings as false positives (#64)",
        "chore(deps-dev): bump the development-dependencies group (#71)",
      ]),
    ).toBe(
      `### Merged pull requests

- Add Duplicate for roles and environments (#59)
- Triage Semgrep findings as false positives (#64)

### Dependency updates

- chore(deps): bump next from 16.2.9 to 16.2.11 (#72)
- chore(deps-dev): bump the development-dependencies group (#71)
`,
    );
  });

  it("omits a heading for an empty group", () => {
    expect(renderBullets(["Only a change (#1)"])).not.toContain("Dependency updates");
    expect(renderBullets(["chore(deps): bump x (#1)"])).not.toContain("### Merged pull requests");
  });

  it("does not collide with the Added/Changed headings a curated section uses", () => {
    const out = renderBullets(["Only a change (#1)"]);
    expect(out).not.toMatch(/^### Changed?$/m);
    expect(out).not.toMatch(/^### Added$/m);
  });
});

describe("addRelease", () => {
  it("inserts the new section below the preamble and above the previous release", () => {
    const after = addRelease(CHANGELOG, "0.5.0", "2026-07-29", ["Add a thing (#80)"]);
    expect(after.startsWith(`${PREAMBLE}## 0.5.0 - 2026-07-29\n`)).toBe(true);
    expect(after.indexOf("## 0.5.0")).toBeLessThan(after.indexOf("## 0.4.0"));
    expect(after).toContain("## 0.1.0\n\n- Initial release of Cinc Console.\n");
  });

  it("absorbs an Unreleased section, keeping its hand-written prose", () => {
    const withUnreleased = `${PREAMBLE}## Unreleased

### Added

- Added \`.env.example\` with documented defaults.

## 0.4.0 - 2026-06-30

- old
`;
    const after = addRelease(withUnreleased, "0.5.0", "2026-07-29", ["Add a thing (#80)"]);
    expect(after).not.toContain("## Unreleased");
    expect(after).toContain("## 0.5.0 - 2026-07-29\n\n### Added\n");
    expect(after).toContain("- Added `.env.example` with documented defaults.");
    expect(after).toContain("### Merged pull requests\n\n- Add a thing (#80)");
    // The absorbed section must not swallow the release below it.
    expect(after).toContain("## 0.4.0 - 2026-06-30");
  });

  it("leaves exactly one blank line before the next heading", () => {
    const after = addRelease(CHANGELOG, "0.5.0", "2026-07-29", ["Add a thing (#80)"]);
    expect(after).toContain("- Add a thing (#80)\n\n## 0.4.0");
  });

  it("leaves exactly one blank line after its own heading", () => {
    for (const base of [CHANGELOG, `${PREAMBLE}## Unreleased\n\n- curated\n`]) {
      const after = addRelease(base, "0.5.0", "2026-07-29", ["Add a thing (#80)"]);
      expect(after).toMatch(/^## 0\.5\.0 - 2026-07-29\n\n\S/m);
    }
  });

  it("never emits three consecutive newlines anywhere", () => {
    const after = addRelease(CHANGELOG, "0.5.0", "2026-07-29", ["Add a thing (#80)"]);
    expect(after).not.toContain("\n\n\n");
  });
});

describe("extractSection", () => {
  it("returns just the body, for use as release notes", () => {
    expect(extractSection(CHANGELOG, "0.4.0")).toBe(
      "### Merged pull requests\n\n- Use matched brackets in the missing-count range query (#58)\n",
    );
  });

  it("matches on the version token, not a prefix", () => {
    expect(extractSection(CHANGELOG, "0.4")).toBe("");
    expect(extractSection(CHANGELOG, "0.9.9")).toBe("");
  });
});
