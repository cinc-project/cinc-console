// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildSnapshot,
  clientStatus,
  compareVersions,
  isMissing,
  isUnconfigured,
  isRecent,
  checkInBucket,
  CHECKIN_BUCKETS,
  majorOf,
  newestVersion,
  MISSING_AFTER_MS,
  RECENT_WITHIN_MS,
  type ClientLifecycle,
  type FleetNode,
} from "./fleet";

const NOW = 1_700_000_000_000; // fixed "now" in ms

// Mirrors the endoflife.date state we care about: 19 latest, 18 supported,
// 17 and below EOL.
const LIFECYCLE: ClientLifecycle = {
  latestMajor: 19,
  latestVersion: "19.3.15",
  eolMajors: [17, 16, 15],
};

function node(over: Partial<FleetNode> = {}): FleetNode {
  return {
    name: "n",
    ohaiTime: NOW / 1000, // checked in "now" by default
    runList: ["recipe[base]"],
    policyName: null,
    policyGroup: null,
    chefVersion: "19.3.15",
    environment: "production",
    platform: "ubuntu",
    platformVersion: "24.04",
    ...over,
  };
}

describe("isMissing", () => {
  it("is false for a recent check-in", () => {
    expect(isMissing(node({ ohaiTime: NOW / 1000 }), NOW)).toBe(false);
  });

  it("is true past the threshold", () => {
    const old = (NOW - MISSING_AFTER_MS - 1000) / 1000;
    expect(isMissing(node({ ohaiTime: old }), NOW)).toBe(true);
  });

  it("treats a node that never checked in as missing", () => {
    expect(isMissing(node({ ohaiTime: null }), NOW)).toBe(true);
  });
});

describe("isUnconfigured", () => {
  it("is true for empty run-list and no policy", () => {
    expect(isUnconfigured(node({ runList: [], policyName: null }))).toBe(true);
  });

  it("is false when a run-list is present", () => {
    expect(isUnconfigured(node({ runList: ["recipe[x]"] }))).toBe(false);
  });

  it("is false for a policyfile node (empty run-list but a policy)", () => {
    expect(isUnconfigured(node({ runList: [], policyName: "web" }))).toBe(false);
  });

  it("is true for a run-list node left in the _default environment", () => {
    expect(isUnconfigured(node({ environment: "_default" }))).toBe(true);
  });

  it("is false for a policyfile node in _default (policies don't use environments)", () => {
    expect(
      isUnconfigured(node({ runList: [], policyName: "web", environment: "_default" })),
    ).toBe(false);
  });

  it("does not guess when the environment is unknown", () => {
    expect(isUnconfigured(node({ environment: null }))).toBe(false);
  });
});

describe("isRecent", () => {
  it("is true within the last hour, inclusive", () => {
    expect(isRecent(node({ ohaiTime: (NOW - RECENT_WITHIN_MS) / 1000 }), NOW)).toBe(true);
  });

  it("is false past the hour or when never seen", () => {
    expect(isRecent(node({ ohaiTime: (NOW - RECENT_WITHIN_MS - 1000) / 1000 }), NOW)).toBe(false);
    expect(isRecent(node({ ohaiTime: null }), NOW)).toBe(false);
  });
});

describe("checkInBucket", () => {
  const ago = (ms: number) => node({ ohaiTime: (NOW - ms) / 1000 });
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const label = (n: FleetNode) => CHECKIN_BUCKETS[checkInBucket(n, NOW)].label;

  it("places a node by time since its last check-in", () => {
    expect(label(ago(0))).toBe("<30m");
    expect(label(ago(30 * MIN))).toBe("<30m");
    expect(label(ago(45 * MIN))).toBe("30m–1h");
    expect(label(ago(3 * HOUR))).toBe("1–6h");
    expect(label(ago(12 * HOUR))).toBe("6–12h");
    expect(label(ago(13 * HOUR))).toBe("12h–7d");
    expect(label(ago(30 * 24 * HOUR))).toBe(">7d");
    expect(label(node({ ohaiTime: null }))).toBe("never");
  });

  it("splits at the missing threshold so the 12h line falls between buckets", () => {
    // isMissing is `> MISSING_AFTER_MS`: exactly 12h is still present.
    expect(CHECKIN_BUCKETS[checkInBucket(ago(MISSING_AFTER_MS), NOW)].missing).toBe(false);
    expect(CHECKIN_BUCKETS[checkInBucket(ago(MISSING_AFTER_MS + 1000), NOW)].missing).toBe(true);
  });

  it("treats a check-in stamped in the future (clock skew) as just now", () => {
    expect(label(ago(-5 * MIN))).toBe("<30m");
  });
});

describe("compareVersions / newestVersion / majorOf", () => {
  it("orders dotted numeric versions", () => {
    expect(compareVersions("18.4.12", "18.4.2")).toBe(1);
    expect(compareVersions("18.4", "18.4.1")).toBe(-1);
    expect(compareVersions("18.4.0", "18.4")).toBe(0);
  });

  it("extracts the major", () => {
    expect(majorOf("18.10.17")).toBe(18);
    expect(majorOf("not-a-version")).toBe(null);
  });

  it("finds the newest version, ignoring unknowns", () => {
    const nodes = [
      node({ chefVersion: "17.10.0" }),
      node({ chefVersion: null }),
      node({ chefVersion: "18.4.12" }),
    ];
    expect(newestVersion(nodes)).toBe("18.4.12");
  });
});

describe("clientStatus", () => {
  it("is current on the latest major", () => {
    expect(clientStatus(node({ chefVersion: "19.3.15" }), LIFECYCLE, null)).toBe(
      "current",
    );
  });

  it("flags one major behind", () => {
    expect(clientStatus(node({ chefVersion: "18.10.17" }), LIFECYCLE, null)).toBe(
      "major-behind",
    );
  });

  it("flags EOL majors, and EOL wins over major-behind", () => {
    expect(clientStatus(node({ chefVersion: "17.10.163" }), LIFECYCLE, null)).toBe(
      "eol",
    );
  });

  it("is unknown when no version is reported", () => {
    expect(clientStatus(node({ chefVersion: null }), LIFECYCLE, null)).toBe(
      "unknown",
    );
  });

  it("falls back to the fleet's newest major when lifecycle is unavailable", () => {
    const unavailable: ClientLifecycle = {
      latestMajor: null,
      latestVersion: null,
      eolMajors: [],
    };
    // fleet newest major is 19; an 18.x node still reads as major-behind, and
    // nothing is EOL because there's no lifecycle data.
    expect(clientStatus(node({ chefVersion: "18.1.0" }), unavailable, 19)).toBe(
      "major-behind",
    );
    expect(clientStatus(node({ chefVersion: "17.1.0" }), unavailable, 19)).toBe(
      "major-behind",
    );
  });
});

describe("buildSnapshot", () => {
  it("counts diagnostics independently, splits eol vs major-behind, sorts by check-in", () => {
    const nodes: FleetNode[] = [
      node({ name: "web1", ohaiTime: NOW / 1000, chefVersion: "19.3.15" }),
      node({ name: "db1", ohaiTime: (NOW - 1000) / 1000, chefVersion: "18.10.17" }),
      node({
        name: "web2",
        ohaiTime: (NOW - MISSING_AFTER_MS - 1) / 1000, // missing
        chefVersion: "17.10.163", // eol
      }),
      node({
        name: "fresh",
        ohaiTime: null, // missing (never seen)
        runList: [], // unconfigured
        policyName: null,
        chefVersion: null, // unknown client
      }),
    ];

    const snap = buildSnapshot(nodes, NOW, LIFECYCLE);

    expect(snap.stats.total).toBe(4);
    expect(snap.stats.missing).toBe(2); // web2 + fresh
    expect(snap.stats.unconfigured).toBe(1); // fresh
    expect(snap.stats.recent).toBe(2); // web1 + db1
    expect(snap.stats.never).toBe(1); // fresh
    expect(snap.stats.checkIns).toEqual([2, 0, 0, 0, 1, 0, 1]);
    expect(snap.stats.eol).toBe(1); // web2
    expect(snap.stats.majorBehind).toBe(1); // db1
    expect(snap.stats.outdated).toBe(2); // eol + majorBehind
    expect(snap.stats.latestMajor).toBe(19);
    expect(snap.stats.latestVersion).toBe("19.3.15");
    expect(snap.generatedAt).toBe(NOW);

    // most-recently-seen first; null check-in sorts last
    expect(snap.nodes.map((n) => n.name)).toEqual([
      "web1",
      "db1",
      "web2",
      "fresh",
    ]);

    const fresh = snap.nodes.find((n) => n.name === "fresh")!;
    expect(fresh.status).toBe("missing"); // missing wins over unconfigured
    expect(fresh.clientStatus).toBe("unknown");
  });

  it("carries independent diagnostic flags so a tile filter matches its count", () => {
    // A never-converged node is BOTH missing and unconfigured. The badge is
    // single-valued (missing wins), but the per-node flags must mirror the stat
    // tiles exactly, or the unconfigured filter selects nothing the tile counted.
    const fresh = node({
      name: "fresh",
      ohaiTime: null, // missing (never seen)
      runList: [], // unconfigured
      policyName: null,
    });

    const snap = buildSnapshot([fresh], NOW, LIFECYCLE);
    const row = snap.nodes[0];

    expect(snap.stats.missing).toBe(1);
    expect(snap.stats.unconfigured).toBe(1);
    // The row badge collapses to one status, but both flags are set, so a
    // filter on either flag selects exactly the node its tile counted.
    expect(row.status).toBe("missing");
    expect(row.missing).toBe(true);
    expect(row.unconfigured).toBe(true);
    expect(snap.nodes.filter((n) => n.unconfigured)).toHaveLength(
      snap.stats.unconfigured,
    );
    expect(snap.nodes.filter((n) => n.missing)).toHaveLength(
      snap.stats.missing,
    );
  });

  it("splits unconfigured into empty run list vs _default, counting a node once", () => {
    const snap = buildSnapshot(
      [
        node({ name: "a", runList: [] }), // empty run list
        node({ name: "b", environment: "_default" }), // _default
        node({ name: "c", runList: [], environment: "_default" }), // both
        node({ name: "d" }), // configured
      ],
      NOW,
      LIFECYCLE,
    );
    expect(snap.stats.unconfigured).toBe(3);
    expect(snap.stats.emptyRunList).toBe(2);
    expect(snap.stats.defaultEnv).toBe(2);

    const c = snap.nodes.find((n) => n.name === "c")!;
    expect(c.emptyRunList).toBe(true);
    expect(c.defaultEnv).toBe(true);
    expect(c.environment).toBe("_default");
    expect(c.platform).toBe("ubuntu");
    expect(c.platformVersion).toBe("24.04");
    expect(c.recent).toBe(true);
  });
});
